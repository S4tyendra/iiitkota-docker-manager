# Docker Image Manager

A simple, self-hosted web dashboard built with Bun and Hono to manage Docker images and containers, with deep integration for GitHub Container Registry (GHCR) and automated Nginx proxy configuration.

This tool provides a single-pane-of-glass view to compare local container images against the latest versions in your `iiitkota` GHCR organization, update them, manage container lifecycles, and automatically configure Nginx as a reverse proxy.

## Features

  * **GHCR Integration:** Automatically fetches all container packages from the `iiitkota` GitHub organization.
  * **Version-Aware Dashboard:** Compares the latest 4-digit numeric tag (e.g., `2025`) from GHCR against locally pulled images.
  * **Status Tracking:** Clearly displays container status (e.g., `running`, `stopped`, `update_available`, `running_outdated`).
  * **One-Click Updates:** Pull the latest image from GHCR with real-time stream output to the UI.
  * **Container Lifecycle Management:**
      * Start, stop, restart, and remove containers.
      * Stream container logs directly to the browser.
      * Create and recreate containers using dynamically generated `docker-compose.yml` files.
  * **Persistent Configuration:**
      * Manages per-service `.env` files for environment variables.
      * Saves container configurations (CPU/memory limits, ports, restart policies) to a `config.json` file.
  * **Automated Nginx Proxying:**
      * Reads and parses the Nginx config file at `/etc/nginx/sites-available/iiit-apis`.
      * When starting/recreating a container with a `domain` specified, it automatically adds, updates, or removes the corresponding Nginx `server` block.
  * **Nginx Control Panel:**
      * A web UI to view and edit the Nginx configuration file directly.
      * Safely tests (`sudo nginx -t`) and reloads (`sudo systemctl reload nginx`) the Nginx service.
      * Automatically backs up the Nginx config to `./backups/` before applying changes.
  * **Secure:** Protected by Basic Authentication.

## Architecture

This application is a single-binary service built with **Hono** running on **Bun**.

1.  **Backend (Hono):** Serves a static HTML page (which acts as the frontend) and provides a set of API endpoints.
2.  **Docker Engine:** Uses the `dockerode` library to communicate with the Docker daemon socket (`/var/run/docker.sock`).
3.  **GHCR API:** Uses `fetch` and a `GITHUB_PAT` to query the GitHub API for package and version information.
4.  **File System:** Manages persistent configuration and environment files stored in the user's home directory (`~/.dckr/env/`).
5.  **System Calls:** Executes `docker compose`, `sudo nginx`, and `sudo systemctl` commands to manage containers and the Nginx service.

## Requirements

  * **Bun.js**
  * **Docker**
  * **Nginx** installed and configured.
  * The user running this application must have:
      * Permission to access the Docker daemon socket.
      * **Passwordless `sudo` access** for `nginx -t` and `systemctl reload nginx`. This is critical for the Nginx integration to work.

## Configuration (Environment Variables)

Create a `.env` file in the project root or set these environment variables:

```bash
# Required: A GitHub Personal Access Token (classic)
# Needs `read:packages` scope.
GITHUB_PAT="ghp_YOUR_GITHUB_TOKEN"

# Optional: Port for this manager application
PORT="8080"

# Optional: Credentials for the dashboard
AUTH_USERNAME="admin"
AUTH_PASSWORD="docker123"
```

## Installation & Usage

1.  **Install dependencies:**

    ```bash
    bun install
    ```

2.  **Run in development (with hot reload):**

    ```bash
    bun run dev
    ```

3.  **Build for production:**

    ```bash
    bun run build
    ```

4.  **Run in production:**

    ```bash
    bun run start
    ```

The application will be available at `http://localhost:8080` (or your specified `PORT`).

## Persistent Storage

The application stores all persistent data for your services in the user's home directory to survive restarts and container recreation.

  * **Base Directory:** `~/.dckr/env/`
  * **Environment Files:** `~/.dckr/env/<service-name>/.env`
  * **Config Files:** `~/.dckr/env/<service-name>/config.json`
  * **Compose Files:** `~/.dckr/env/<service-name>/docker-compose.yml` (auto-generated)

## Nginx Integration

This is a core feature. The manager is hardcoded to read and write to:
`/etc/nginx/sites-available/iiit-apis`

  * When you set a `domain` (e.g., "my-app") and `hostPort` for a service and click "Start" or "Save & Recreate", the app:

    1.  Looks for an existing `server` block in the config file that proxies to that `hostPort`.
    2.  If found, it updates the `server_name` to `my-app.iiitkota.ac.in`.
    3.  If not found, it appends a new `server` block.
    4.  If the `domain` is cleared, it removes the corresponding `server` block.

  * The **"⚡ Nginx"** button opens a modal where you can edit the config file. Clicking "Save, Test & Reload" will:

    1.  Backup the current config.
    2.  Write the new config.
    3.  Run `sudo nginx -t`.
    4.  If the test fails, it restores the backup.
    5.  If the test passes, it runs `sudo systemctl reload nginx`.

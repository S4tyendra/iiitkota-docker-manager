import { Toaster } from "@/components/ui/sonner";
import { ServiceList } from "@/components/ServiceList";
import { ServiceForm } from "@/components/ServiceForm";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ImagePuller } from "@/components/ImagePuller";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Docker Manager</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">IIIT Kota</span>
          </div>
          <div className="flex items-center gap-2">
            <ImagePuller />
            <ServiceForm />
            <SettingsDialog />
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="grid gap-8">
          <ServiceList />
        </div>
      </main>

      <Toaster />
    </div>
  );
}

export default App;;
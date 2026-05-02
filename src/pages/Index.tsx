import PaintApp from "@/components/paint/PaintApp";
import { useIsMobile } from "@/hooks/use-mobile";
import { Monitor } from "lucide-react";

const Index = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <Monitor className="h-16 w-16 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Desktop Only
          </h1>
          <p className="text-muted-foreground">
            This website is not made for phones. Please open it on a desktop or
            laptop computer for the best experience.
          </p>
        </div>
      </main>
    );
  }

  return <PaintApp />;
};

export default Index;

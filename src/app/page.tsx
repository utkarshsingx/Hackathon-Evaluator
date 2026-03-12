import { Dashboard } from "@/components/dashboard";
import { HeroSection } from "@/components/HeroSection";

export default function Home() {
  return (
    <>
      <HeroSection />
      <main id="dashboard">
        <Dashboard />
      </main>
    </>
  );
}

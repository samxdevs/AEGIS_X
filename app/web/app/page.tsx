import { SiteNav } from "@/components/site-nav";
import { Hero } from "@/components/sections/hero";
import { TwoPass } from "@/components/sections/two-pass";
import { Workflow } from "@/components/sections/workflow";
import { LayerStack } from "@/components/sections/layer-stack";
import { Evidence } from "@/components/sections/evidence";
import { Feasibility } from "@/components/sections/feasibility";
import { Impact } from "@/components/sections/impact";
import { Closing } from "@/components/sections/closing";

export default function Page() {
  return (
    <main className="flex-1">
      <SiteNav />
      <Hero />
      <TwoPass />
      <Workflow />
      <LayerStack />
      <Evidence />
      <Feasibility />
      <Impact />
      <Closing />
    </main>
  );
}

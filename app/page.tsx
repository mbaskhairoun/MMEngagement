import { Countdown } from "@/components/site/Countdown";
import { DressCode } from "@/components/site/DressCode";
import { Footer } from "@/components/site/Footer";
import { Gallery } from "@/components/site/Gallery";
import { Hero } from "@/components/site/Hero";
import { RsvpSection } from "@/components/site/rsvp/RsvpSection";
import { SiteShell } from "@/components/site/SiteShell";
import { TheDay } from "@/components/site/TheDay";
import { TravelStay } from "@/components/site/TravelStay";
import { Wave } from "@/components/site/Wave";
import { Welcome } from "@/components/site/Welcome";

export default function HomePage() {
  return (
    <SiteShell footer={<Footer />}>
      <Hero />
      <Welcome />
      <Wave top="var(--cream-100)" bottom="var(--sea-50)" />
      <Countdown />
      <Wave top="var(--sea-50)" bottom="var(--cream-100)" flip />
      <TheDay />
      <Wave top="var(--cream-100)" bottom="var(--sea-50)" />
      <TravelStay />
      <Wave top="var(--sea-50)" bottom="var(--cream-100)" flip />
      <DressCode />
      <Gallery />
      <Wave top="var(--cream-100)" bottom="var(--sea-100)" />
      <RsvpSection />
    </SiteShell>
  );
}

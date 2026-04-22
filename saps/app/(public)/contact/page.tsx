import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — Plan with Genie",
};

export default function ContactPage() {
  return <ContactForm />;
}

import type { Metadata } from "next";
import { RequestSchoolForm } from "./request-school-form";

export const metadata: Metadata = {
  title: "Request your school — Plan with Genie",
  description:
    "Tell us where you're from. We'll email you the moment Plan with Genie supports your school.",
};

export default function RequestSchoolPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6 sm:py-24">
      <RequestSchoolForm />
    </section>
  );
}

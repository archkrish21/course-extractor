import PublicLayout from "./(public)/layout";
import HomePage from "./(public)/page";

export default function RootPage() {
  return (
    <PublicLayout>
      <HomePage />
    </PublicLayout>
  );
}

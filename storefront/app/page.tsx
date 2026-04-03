import { redirect } from "next/navigation";

// Root landing — redirect to a demo store or show a bazar landing� redirect to a demo store or show a bazar landing
export default function RootPage() {
  redirect("/store");
}

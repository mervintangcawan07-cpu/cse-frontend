// Relative Path: src/app/partner-portal/page.tsx
import { redirect } from "next/navigation";
import { getAuthenticatedPartner } from "@/lib/partnerAuth";

export default async function PartnerPortalRootPage() {
  const partner = await getAuthenticatedPartner();

  if (partner) {
    redirect("/partner-portal/dashboard");
  } else {
    redirect("/partner-portal/login");
  }
}

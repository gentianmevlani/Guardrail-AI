import { redirect } from "next/navigation";

/**
 * @deprecated This route has been consolidated into /ship
 * Redirects to the main Ship page
 */
export default function ShipCheckPage() {
  redirect("/ship");
}

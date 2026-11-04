import { redirect } from "next/navigation";
import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { DEFAULT_LINK_CODE } from "@/lib/devpanel/salesTypes";

export default function SalesDefaultRedirect() {
  redirect(`https://${BASE_DOMAIN}/apply/${DEFAULT_LINK_CODE}`);
}

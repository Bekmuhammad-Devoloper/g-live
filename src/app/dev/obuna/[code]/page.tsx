import { redirect } from "next/navigation";
import { BASE_DOMAIN } from "@/lib/devpanel/registry";
import { DEFAULT_LINK_CODE } from "@/lib/devpanel/salesTypes";

export default async function SalesLinkRedirect({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`https://${BASE_DOMAIN}/apply/${code === "umumiy" ? DEFAULT_LINK_CODE : encodeURIComponent(code)}`);
}

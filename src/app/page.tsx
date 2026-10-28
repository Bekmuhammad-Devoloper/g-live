import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === ROLES.STUDENT ? "/student" : "/dashboard");
}

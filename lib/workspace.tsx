import { configured, currentUser } from "./auth";
import Hub from "@/components/hub";
import Login from "@/components/login";
export default async function Workspace({
  projectId,
}: { projectId?: string } = {}) {
  if (!configured()) return <Login setup />;
  const user = await currentUser();
  if (!user) return <Login />;
  return <Hub email={user.email} initialProject={projectId} />;
}

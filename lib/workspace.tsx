import { configured, currentUser } from "./auth";
import MobileCapture from "@/components/mobile-capture";
import Hub from "@/components/hub";
import Login from "@/components/login";
export default async function Workspace({
  projectId,
  capture = false,
}: { projectId?: string; capture?: boolean } = {}) {
  if (!configured()) return <Login setup />;
  const user = await currentUser();
  if (!user) return <Login />;
  if (capture) return <MobileCapture email={user.email} />;
  return <Hub email={user.email} initialProject={projectId} />;
}

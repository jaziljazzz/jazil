import { Bell, Briefcase, ChevronRight, LayoutDashboard, LogOut, Recycle, Settings, Upload, Users } from "lucide-react";
import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { getSession } from "@/lib/session";

export const metadata = { title: "Me" };

export default async function MePage() {
  const { profile, isFounder } = await getSession();
  const items = [
    { href: "/dashboard", label: isFounder ? "Founder dashboard" : "My dashboard", icon: LayoutDashboard },
    { href: "/deals", label: "Deals", icon: Briefcase },
    { href: "/notifications", label: "Notifications", icon: Bell },
    ...(isFounder ? [
      { href: "/team", label: "Team", icon: Users },
      { href: "/upload", label: "Upload leads", icon: Upload },
      { href: "/recycle", label: "Recycle pool", icon: Recycle },
      { href: "/settings", label: "Settings", icon: Settings },
    ] : []),
  ];
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={profile.name} className="size-12 text-[15px]" />
        <div>
          <p className="text-[16px] font-semibold">{profile.name}</p>
          <p className="text-[13px] capitalize text-muted">{profile.role} · {profile.email}</p>
        </div>
      </Card>
      <Card className="divide-y divide-line">
        {items.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex h-14 items-center gap-3 px-4">
            <Icon className="size-5 text-muted" /><span className="flex-1 text-[15px]">{label}</span><ChevronRight className="size-4 text-muted" />
          </Link>
        ))}
      </Card>
      <form action="/auth/signout" method="post">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-line bg-surface text-[15px] text-danger"><LogOut className="size-4" /> Sign out</button>
      </form>
    </div>
  );
}

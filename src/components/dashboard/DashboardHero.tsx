import Image from "next/image";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import type { DashboardUser } from "./dashboardTypes";

interface DashboardHeroProps {
  readonly user: DashboardUser | null;
}

export default function DashboardHero({
  user,
}: DashboardHeroProps) {
  const initial =
    user?.name?.trim()?.[0]?.toUpperCase() || "U";

  return (
    <section
      className="
        relative
        min-h-[250px]
        overflow-hidden
        bg-slate-950
        bg-cover
        bg-[position:58%_center]
        text-white
        shadow-lg

        sm:min-h-[265px]

        md:min-h-[285px]
        md:bg-center

        lg:min-h-[300px]

        xl:min-h-[340px]
        xl:bg-[position:center_48%]
        xl:rounded-none
        xl:shadow-none

        2xl:min-h-[370px]
        2xl:bg-center
      "
      style={{
        backgroundImage: "url('/brand/mobile6.png')",
      }}
    >
      {/* Horizontal readability overlay */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-r
          from-slate-950/92
          via-blue-950/68
          to-blue-950/18
        "
      />

      {/* Vertical image-depth overlay */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-slate-950/55
          via-transparent
          to-slate-950/25
        "
      />

      <div
        className="
          relative
          z-10
          flex
          min-h-[250px]
          flex-col
          px-4
          pb-10
          pt-4

          sm:min-h-[265px]
          sm:px-5

          md:min-h-[285px]
          md:px-7
          md:pb-12
          md:pt-5

          lg:min-h-[300px]
          lg:px-8

          xl:min-h-[340px]
          xl:px-9
          xl:pb-14

          2xl:min-h-[370px]
          2xl:px-10
          2xl:pb-16
        "
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="
              inline-flex
              items-center
              gap-2.5
              rounded-xl
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-white/80
            "
          >
            <span
              className="
                h-9
                w-9
                overflow-hidden
                rounded-xl
                bg-white/10
                ring-1
                ring-white/15
                backdrop-blur-sm
              "
            >
              <Image
                src="/brand/govstudyx-icon.png"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </span>

            <span className="text-base font-black tracking-tight text-white sm:text-lg">
              GovStudy</span><span className="text-[23px] text-blue-300">X</span>
            
          </Link>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/95 p-0.5 text-slate-950 shadow-sm">
              <NotificationBell />
            </div>

            <Link
              href="/profile"
              title={user?.name || "My Account"}
              className="
                grid
                h-9
                w-9
                place-items-center
                rounded-full
                border
                border-white/20
                bg-white/15
                text-xs
                font-black
                text-white
                backdrop-blur-md
                transition
                hover:bg-white/25
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-white/80
              "
            >
              {initial}
            </Link>
          </div>
        </div>

        {/* Greeting */}
        <div
          className="
            mt-5
            max-w-2xl
            pb-1

            sm:mt-10
            md:mt-10
            lg:mt-10
            xl:mt-15
            2xl:mt-15
          "
        >
          <p className="text-sm font-medium text-blue-100 md:text-base">
            Welcome back,
          </p>

          <h1
            className="
              mt-0.5
              text-2xl
              font-black
              tracking-tight
              text-white

              sm:text-[28px]
              md:text-4xl
              xl:text-[2.65rem]
              2xl:text-[2.85rem]
            "
          >
            {user?.name || "Reviewee"}
          </h1>

          <p
            className="
              mt-2
              max-w-xl
              text-xs
              font-medium
              leading-relaxed
              text-blue-100/95

              sm:text-[13px]
              md:text-sm
              xl:max-w-2xl
              xl:text-[15px]
              2xl:text-base
            "
          >
            Stay consistent. Focused practice builds stronger
            Civil Service exam readiness.
          </p>
        </div>
      </div>
    </section>
  );
}
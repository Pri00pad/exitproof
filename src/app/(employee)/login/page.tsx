import { CheckCircleIcon, ClockIcon, LinkIcon } from "@/components/icons";
import { LoginForms } from "./LoginForms";

const POINTS = [
  { Icon: CheckCircleIcon, text: "Track every exit item in one place, from laptop return to relieving letter." },
  { Icon: LinkIcon, text: "Send HR a private verification link. HR doesn't need an account." },
  { Icon: ClockIcon, text: "See at a glance what's validated, what's waiting, and what's overdue." },
];

export default function LoginPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="text-sm font-medium text-blue-700">Employee-initiated exit tracker</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
          Know exactly what HR has validated before you leave.
        </h1>
        <p className="mt-4 max-w-prose text-base leading-7 text-slate-600">
          For employees leaving companies where offboarding still runs on email, WhatsApp and spreadsheets.
        </p>
        <ul className="mt-8 space-y-4">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-6 text-slate-700">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                <Icon className="size-4" />
              </span>
              <span className="pt-1">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="w-full lg:max-w-md lg:justify-self-end">
        <LoginForms />
      </div>
    </main>
  );
}

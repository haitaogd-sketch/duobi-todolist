import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="duobi-shell flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="relative z-10 w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}

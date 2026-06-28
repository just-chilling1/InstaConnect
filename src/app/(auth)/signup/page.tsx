import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <AuthForm
      heading="Create your account"
      subheading="No password to remember — we'll email you a one-time code."
    />
  );
}

import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { BookOpen } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-8 flex flex-col items-center text-center">
        
        {/* Logo and Welcome Text */}
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <BookOpen className="w-12 h-12 text-gray-900" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Professor</h1>
          <p className="text-lg text-gray-900 font-semibold mt-2">Bem-vindo(a)!</p>
          <p className="text-sm text-gray-500">Faça seu login para continuar</p>
        </div>

        {/* Form Components */}
        <LoginForm />

        <div className="mt-8 text-sm">
          <Link href="/auth/register" className="text-gray-900 font-semibold hover:underline">
            Criar minha conta
          </Link>
        </div>
      </div>
    </main>
  );
}

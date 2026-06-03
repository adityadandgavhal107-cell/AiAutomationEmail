import { Zap } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side: Premium Branding panel (hidden on mobile) */}
      <div className="relative hidden w-0 flex-1 lg:flex lg:flex-col lg:justify-between bg-zinc-950 p-12 overflow-hidden border-r border-border">
        {/* Background Mesh Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-purple-500/5 to-transparent pointer-events-none" />
        <div className="absolute -left-1/4 -bottom-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">AI Outreach</span>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 my-auto max-w-md space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            Supercharge your cold outreach with <span className="gradient-text">AI agents</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Automate personalized email generation, track lead relationships, and scale campaigns effortlessly with our CRM-integrated intelligence.
          </p>
          
          {/* Micro Card Display */}
          <div className="glass-card p-5 rounded-2xl border border-border/50 shadow-2xl relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                98%
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Higher Engagement Rates</p>
                <p className="text-xs text-muted-foreground mt-1">Our AI drafts customize templates dynamically to fit your lead's role and company details perfectly.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} AI Outreach. Built for elite sales teams.
        </div>
      </div>

      {/* Right side: Auth Form */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-background">
        <div className="mx-auto w-full max-w-sm lg:w-96 animate-fade-in-up">
          {children}
        </div>
      </div>
    </div>
  )
}

export function TrialExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">⏰</div>
        <h1 className="text-2xl font-bold">Your trial has ended</h1>
        <p className="text-muted-foreground">
          Your free trial period has expired. To continue using CRM Stack,
          please contact support to upgrade your plan.
        </p>
        <a
          href="mailto:support@crmstack.com"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Contact Support
        </a>
      </div>
    </div>
  )
}

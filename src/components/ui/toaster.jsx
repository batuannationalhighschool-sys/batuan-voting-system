import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const toastMeta = {
  default: { Icon: Info, iconClass: "bg-primary/10 text-primary" },
  info: { Icon: Info, iconClass: "bg-primary/10 text-primary" },
  success: { Icon: CheckCircle2, iconClass: "bg-success/10 text-success" },
  warning: { Icon: AlertTriangle, iconClass: "bg-gold/15 text-gold" },
  destructive: { Icon: XCircle, iconClass: "bg-destructive/10 text-destructive" },
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider label="Notifications" duration={5000} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, variant = "default", ...props }) {
        const { Icon, iconClass } = toastMeta[variant] || toastMeta.default;
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action && <div className="mt-0.5 shrink-0">{action}</div>}
            <ToastClose aria-label="Dismiss notification" />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

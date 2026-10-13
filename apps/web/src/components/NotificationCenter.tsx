import { useEffect, useRef } from 'react';
import { bindNotifications } from '../../../../packages/shared-ui/notifications.js';
export function NotificationCenter() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current ? bindNotifications(root.current) : undefined, []);
  return <div ref={root} />;
}

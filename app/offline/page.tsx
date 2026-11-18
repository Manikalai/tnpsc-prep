import OfflineApp from "@/components/offline/OfflineApp";

// Static page: cached by the service worker so it opens without internet.
export default function OfflinePage() {
  return <OfflineApp />;
}

import type { Metadata } from "next";
import "./globals.css";
import WalletModal from "@/src/modals/wallet";
import TokenSelectorModal from "@/src/modals/token-selector";
import Providers from "./providers";
import Layout from "@/src/components/layout";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Euclid Nextjs Starter",
  description: "Euclid Nextjs Starter Template",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Layout>
            {children}
          </Layout>
          <WalletModal />
          <TokenSelectorModal />
        </Providers>
        <Toaster 
          position="top-right"
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgb(30, 41, 59)',
              border: '1px solid rgb(71, 85, 105)',
              color: 'white',
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Terms & Conditions
              </span>
            </h1>
            <p className="text-muted-foreground">Last updated: December 2025</p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using MinMaxValue ("the Platform"), you agree to be bound by these Terms & Conditions. If you do not agree to these terms, do not use the Platform.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                MinMaxValue is an independent secondary marketplace that facilitates the resale of poker tournament entries between users. We do not operate, organize, or guarantee any tournaments listed on the Platform. All events are operated by third-party casinos and venues.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                You must be at least 21 years old to use MinMaxValue. By using the Platform, you represent that you meet this age requirement and are legally permitted to participate in poker tournaments in your jurisdiction.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Account Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate and complete information during registration and keep it updated.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Listing and Purchasing</h2>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">For Sellers</h3>
                  <p className="text-sm text-muted-foreground">
                    By listing a ticket, you confirm you have a valid, transferable tournament entry. You agree to provide accurate information about the entry and cooperate with the casino verification process.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">For Buyers</h3>
                  <p className="text-sm text-muted-foreground">
                    Purchases are subject to casino verification. The transfer is only complete when approved by the partner casino. You must provide accurate personal information for the transfer.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Fees and Payments</h2>
              <p className="text-muted-foreground leading-relaxed">
                MinMaxValue charges a service fee on transactions. Fees are disclosed before purchase completion. Seller proceeds are credited to their wallet after casino approval and are subject to our payout terms.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Verification Process</h2>
              <p className="text-muted-foreground leading-relaxed">
                All transactions require verification by the partner casino. MinMaxValue is not responsible for delays or rejections by casinos. If a transfer is declined, appropriate refunds or reversals will be processed.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Prohibited Conduct</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">You agree not to:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>List tickets you do not legitimately own</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Provide false information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Attempt to circumvent the verification process</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Use the Platform for money laundering or fraud</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Interfere with the Platform's operation</span>
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                MinMaxValue is a marketplace platform. We are not responsible for tournament cancellations, changes, or issues arising from the events themselves. Our liability is limited to the fees collected on disputed transactions.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Disputes</h2>
              <p className="text-muted-foreground leading-relaxed">
                Transaction disputes should be reported promptly through the Platform. We will investigate and work toward fair resolution, but final decisions on ticket validity rest with the partner casinos.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Modifications</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms, contact us at{" "}
                <a href="mailto:legal@minmaxvalue.com" className="text-primary hover:underline">
                  legal@minmaxvalue.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;

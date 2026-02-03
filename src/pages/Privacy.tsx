import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Privacy Policy
              </span>
            </h1>
            <p className="text-muted-foreground">Last updated: December 2025</p>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Account Information</h3>
                  <p className="text-sm text-muted-foreground">
                    When you create an account, we collect your name, email address, username, and date of birth. This information is necessary to provide our services and verify your eligibility.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Transaction Information</h3>
                  <p className="text-sm text-muted-foreground">
                    When you buy or sell tickets, we collect details about the transaction including ticket information, pricing, and identity information required for casino verification (name, date of birth, casino alias).
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Usage Data</h3>
                  <p className="text-sm text-muted-foreground">
                    We automatically collect information about how you use the Platform, including pages visited, features used, and device information.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">We use collected information to:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Provide and improve our services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Process transactions and facilitate ticket transfers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Verify your identity with partner casinos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Communicate with you about your account and transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Detect and prevent fraud</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Comply with legal obligations</span>
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Partner Casinos</h3>
                  <p className="text-sm text-muted-foreground">
                    To complete ticket transfers, we share necessary buyer and seller information with the relevant casino for verification purposes. This includes name, date of birth, and casino alias.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Service Providers</h3>
                  <p className="text-sm text-muted-foreground">
                    We work with third-party service providers for payment processing, hosting, and analytics. These providers only access information necessary to perform their services.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-medium mb-2">Legal Requirements</h3>
                  <p className="text-sm text-muted-foreground">
                    We may disclose information when required by law or to protect our rights, safety, or property.
                  </p>
                </div>
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement industry-standard security measures to protect your information. However, no system is completely secure. You are responsible for maintaining the security of your account credentials.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide services. Transaction records are kept for legal and compliance purposes.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Depending on your location, you may have rights to:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Access your personal information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Correct inaccurate information</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Delete your account and associated data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Object to certain processing activities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Export your data</span>
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar technologies to maintain your session, remember preferences, and analyze usage. You can control cookies through your browser settings.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                MinMaxValue is not intended for users under 21 years of age. We do not knowingly collect information from minors.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">9. International Users</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you access the Platform from outside the United States, your information may be transferred to and processed in countries with different privacy laws.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy periodically. We will notify you of significant changes through the Platform or via email.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                For privacy-related questions or to exercise your rights, contact us at{" "}
                <a href="mailto:privacy@minmaxvalue.com" className="text-primary hover:underline">
                  privacy@minmaxvalue.com
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

export default Privacy;

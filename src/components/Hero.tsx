import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

const Hero = () => {
  const { t } = useTranslation();
  
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-card" />
      
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
      
      <div className="relative z-10 text-center max-w-5xl mx-auto space-y-8">
        <h1 className="text-5xl md:text-7xl font-bold leading-tight">
          <span className="bg-gradient-to-r from-primary via-accent to-yellow-400 bg-clip-text text-transparent">
            {t('hero.title')}
          </span>
          <br />
          <span className="text-foreground">{t('hero.subtitle')}</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          {t('hero.description')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Link to="/browse">
            <Button size="lg" className="text-base">
              {t('hero.browseTickets')}
            </Button>
          </Link>
          <Link to="/list-ticket">
            <Button size="lg" variant="outline" className="text-base">
              {t('hero.listYourTicket')}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;

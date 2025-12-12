import { motion } from "framer-motion";

interface StepTitleProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
}

export const StepTitle = ({ step, totalSteps, title, subtitle }: StepTitleProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-6"
    >
      <p 
        className="text-xs font-semibold uppercase tracking-widest mb-2"
        style={{ color: '#C5A46D' }}
      >
        Etapa {step} de {totalSteps}
      </p>
      <h2 
        className="text-2xl font-bold mb-2"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p 
          className="text-sm"
          style={{ color: 'rgba(255, 255, 255, 0.5)' }}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

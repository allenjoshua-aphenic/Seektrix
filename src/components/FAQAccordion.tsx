import React, { useState } from 'react';
import { FAQItem } from '../types';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FAQAccordionProps {
  items: FAQItem[];
}

export default function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Group by category for realistic presentation
  const categories = Array.from(new Set(items.map((item) => item.category)));

  return (
    <div className="space-y-8" id="faq-accordion-root">
      {categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category);
        
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-xs font-bold font-mono tracking-wider text-cofounder-blue uppercase border-b border-gray-100 pb-1">
              {category}
            </h3>
            
            <div className="space-y-2">
              {categoryItems.map((item, localIdx) => {
                const globalIdx = items.indexOf(item);
                const isOpen = openIndex === globalIdx;

                return (
                  <div 
                    key={localIdx}
                    className="glass-panel-light rounded-xl border border-white/60 shadow-[0_2px_10px_rgba(0,0,0,0.015)] overflow-hidden transition-all duration-300 hover:border-cofounder-blue/50"
                  >
                    <button
                      onClick={() => toggleIndex(globalIdx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-medium text-dark-charcoal focus:outline-none focus:ring-2 focus:ring-cofounder-blue/20 cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center space-x-3 pr-4">
                        <HelpCircle className="w-4 h-4 text-cofounder-blue shrink-0" />
                        <span className="font-sans text-dark-charcoal font-semibold leading-snug">{item.question}</span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#646464] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#646464] shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4.5 pt-1 text-xs text-[#52525b] border-t border-gray-100/50 bg-white/20 font-sans leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

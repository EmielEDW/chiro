import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

const categories = [
  { key: 'frisdranken', name: 'Frisdranken', color: 'bg-blue-100 text-blue-800' },
  { key: 'bieren', name: 'Bieren', color: 'bg-amber-100 text-amber-800' },
  { key: 'sterke_dranken', name: 'Sterke dranken', color: 'bg-red-100 text-red-800' },
  { key: 'mixed_drinks', name: 'Mixed Drinks', color: 'bg-purple-100 text-purple-800' },
  { key: 'chips', name: 'Chips', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'andere', name: 'Andere', color: 'bg-gray-100 text-gray-800' }
];

interface MobileCategoryFilterProps {
  onCategorySelect: (category: string) => void;
  selectedCategory?: string;
}

const MobileCategoryFilter: React.FC<MobileCategoryFilterProps> = ({ 
  onCategorySelect, 
  selectedCategory 
}) => {
  const [isSticky, setIsSticky] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const filterBarElement = document.getElementById('category-filter-anchor');
      const headerHeight = 64; // Height of the main header
      
      if (filterBarElement) {
        const filterBarTop = filterBarElement.offsetTop;
        
        // Show the filter bar when we're approaching it
        if (scrollY >= filterBarTop - headerHeight - 50) {
          setIsVisible(true);
          
          // Make it sticky when we reach the exact position
          if (scrollY >= filterBarTop - headerHeight) {
            setIsSticky(true);
          } else {
            setIsSticky(false);
          }
        } else {
          setIsVisible(false);
          setIsSticky(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  const scrollToCategory = (categoryKey: string) => {
    const categoryElement = document.querySelector(`[data-category="${categoryKey}"]`);
    if (categoryElement) {
      const headerHeight = 64;
      const filterBarHeight = 60;
      const offsetTop = categoryElement.getBoundingClientRect().top + window.scrollY - headerHeight - filterBarHeight - 10;
      
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      
      onCategorySelect(categoryKey);
    }
  };

  if (!isMobile) return null;

  return (
    <>
      {/* Anchor point to detect when to show the filter bar */}
      <div id="category-filter-anchor" className="h-0" />
      
      {/* Mobile Category Filter Bar */}
      <div 
        className={`
          transition-all duration-500 ease-in-out
          ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}
          ${isSticky ? 'fixed top-0 left-0 right-0 z-40' : 'relative'}
          bg-card border-b border-border
        `}
        style={{
          height: isVisible ? '60px' : '0px',
          overflow: 'hidden'
        }}
      >
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
            <Button
              variant={!selectedCategory ? "default" : "outline"}
              size="sm"
              onClick={() => {
                onCategorySelect('');
                window.scrollTo({
                  top: document.querySelector('[data-category]')?.getBoundingClientRect().top! + window.scrollY - 120,
                  behavior: 'smooth'
                });
              }}
              className="whitespace-nowrap flex-shrink-0 text-xs h-8"
            >
              Alles
            </Button>
            
            {categories.map((category) => (
              <Badge
                key={category.key}
                variant={selectedCategory === category.key ? "default" : "outline"}
                className={`
                  cursor-pointer whitespace-nowrap flex-shrink-0 text-xs h-8 px-3
                  transition-colors duration-200 hover:opacity-80
                  ${selectedCategory === category.key ? '' : category.color}
                `}
                onClick={() => scrollToCategory(category.key)}
              >
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileCategoryFilter;
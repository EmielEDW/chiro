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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    // Store the original position of the filter bar
    let originalOffsetTop = 0;
    
    const filterBarElement = document.getElementById('category-filter-bar');
    if (filterBarElement) {
      originalOffsetTop = filterBarElement.offsetTop;
    }

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const mainHeader = document.getElementById('main-header');
      
      if (mainHeader) {
        // Return to normal position when scroll is at or above the original position
        if (scrollY <= originalOffsetTop) {
          setIsSticky(false);
          mainHeader.style.opacity = '1';
          mainHeader.style.transform = 'translateY(0)';
        }
        // Make filter bar sticky when scrolled past its original position
        else if (scrollY > originalOffsetTop) {
          setIsSticky(true);
          mainHeader.style.opacity = '0';
          mainHeader.style.transform = 'translateY(-100%)';
        }
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Cleanup: restore nav bar when component unmounts
      const mainHeader = document.getElementById('main-header');
      if (mainHeader) {
        mainHeader.style.opacity = '1';
        mainHeader.style.transform = 'translateY(0)';
      }
    };
  }, [isMobile]);

  const scrollToCategory = (categoryKey: string) => {
    const categoryElement = document.querySelector(`[data-category="${categoryKey}"]`);
    if (categoryElement) {
      const stickyOffset = isSticky ? 60 : 124; // Account for sticky filter bar or normal header + filter
      const offsetTop = categoryElement.getBoundingClientRect().top + window.scrollY - stickyOffset;
      
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
      
      onCategorySelect(categoryKey);
    }
  };

  if (!isMobile) return null;

  return (
    <div 
      id="category-filter-bar"
      className={`
        transition-all duration-300 ease-in-out glass-nav border-b
        ${isSticky ? 'fixed top-0 left-0 right-0 z-50' : 'relative'}
      `}
      style={isSticky ? { marginTop: 0, paddingTop: 0 } : {}}
    >
      <div className={`container mx-auto px-4 ${isSticky ? 'py-3' : 'py-3'}`}>
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide pb-1">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onCategorySelect('');
              window.scrollTo({
                top: document.querySelector('[data-category]')?.getBoundingClientRect().top! + window.scrollY - (isSticky ? 60 : 124),
                behavior: 'smooth'
              });
            }}
            className="whitespace-nowrap flex-shrink-0 text-xs h-8 min-w-fit"
          >
            Alles
          </Button>
          
          {categories.map((category) => (
            <Badge
              key={category.key}
              variant={selectedCategory === category.key ? "default" : "outline"}
              className={`
                cursor-pointer whitespace-nowrap flex-shrink-0 text-xs h-8 px-3 min-w-fit
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
  );
};

export default MobileCategoryFilter;
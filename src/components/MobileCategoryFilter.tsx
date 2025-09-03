import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';

const categories = [
  { key: 'frisdranken', name: 'Frisdranken', color: 'bg-blue-100 text-blue-800' },
  { key: 'bieren', name: 'Bieren', color: 'bg-amber-100 text-amber-800' },
  { key: 'sterke_dranken', name: 'Sterke dranken', color: 'bg-red-100 text-red-800' },
  { key: 'mixed_drinks', name: 'Mixed Drinks', color: 'bg-purple-100 text-purple-800' },
  { key: 'cocktails', name: 'Cocktails', color: 'bg-pink-100 text-pink-800' },
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

    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const filterBarElement = document.getElementById('category-filter-bar');
      const mainHeader = document.getElementById('main-header');
      
      if (filterBarElement && mainHeader) {
        const filterBarTop = filterBarElement.offsetTop;
        const headerHeight = mainHeader.offsetHeight;
        
        // If we've scrolled to the top, always show the nav bar
        if (scrollY <= 50) {
          setIsSticky(false);
          mainHeader.style.opacity = '1';
          mainHeader.style.transform = 'translateY(0)';
        }
        // Make filter bar sticky and hide main header when they would overlap
        else if (scrollY >= filterBarTop - headerHeight) {
          setIsSticky(true);
          mainHeader.style.opacity = '0';
          mainHeader.style.transform = 'translateY(-100%)';
        } 
        // When scrolling back up and not at the top, restore the filter bar to normal position
        else if (scrollY < lastScrollY && scrollY < filterBarTop - headerHeight) {
          setIsSticky(false);
          mainHeader.style.opacity = '1';
          mainHeader.style.transform = 'translateY(0)';
        }
      }
      
      lastScrollY = scrollY;
    };

    window.addEventListener('scroll', handleScroll);
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
        transition-all duration-300 ease-in-out bg-card border-b border-border
        ${isSticky ? 'fixed top-0 left-0 right-0 z-50 shadow-md' : 'relative'}
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
import React, { Suspense } from 'react';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { PageTemplateSchema, type ValidatedThemeSection } from './schema';
import { getSectionComponent } from './section-registry';
import type { SectionProps } from './types';

// Fallback skeleton loader while Dynamic Imports fetch the component chunks
function SectionLoader() {
  return (
    <div className="w-full flex items-center justify-center p-20 animate-pulse bg-gray-50 my-4 rounded-xl">
      <div className="space-y-4 w-full max-w-4xl opacity-50">
        <div className="h-8 bg-gray-300 w-1/4 rounded"></div>
        <div className="h-4 bg-gray-200 w-full rounded"></div>
        <div className="h-64 bg-gray-200 w-full rounded"></div>
      </div>
    </div>
  );
}

export function SectionRenderer({ 
  sections, 
  globalData,
  pageType = "homepage",
}: { 
  sections: ValidatedThemeSection[]; 
  globalData: SectionProps['globalData'];
  pageType?: string;
}) {
  const themeId = globalData.themeSettings && typeof globalData.themeSettings.themeId === 'string'
    ? globalData.themeSettings.themeId
    : globalData.store.settings?.theme;

  // Schema Validation (Protecting the engine against malformed DB data)
  const parsedLayout = PageTemplateSchema.safeParse({
    pageType,
    sections: sections,
  });

  if (!parsedLayout.success) {
    if (process.env.NODE_ENV === 'development') {
      console.error("Zod Schema Validation Error on Sections Array:", parsedLayout.error);
    }
    // Hardcoded emergency fallback if the entire layout JSON is corrupted
    return (
      <div className="text-center py-20 text-red-600 bg-red-50">
        <h1>هناك خطأ في بيانات هيكل الصفحة (Corrupted Template Code: 500)</h1>
      </div>
    );
  }

  const validSections = parsedLayout.data.sections;

  if (validSections.length === 0) {
    return null; // Empty page
  }

  return (
    <div className="theme-sections-container w-full min-h-screen flex flex-col">
      {validSections.map((section) => {
        // Skip rendering if section is disabled
        if (section.enabled === false) return null;

        const SectionComponent = getSectionComponent(themeId, section.type);
        
        if (!SectionComponent) {
          if (process.env.NODE_ENV === 'development') {
            return (
              <div key={section.id} className="p-4 m-4 border-2 border-dashed border-yellow-500 bg-yellow-50 text-yellow-800 text-center rounded">
                Unregistered Section Type: <strong>{section.type}</strong> (theme: <strong>{themeId ?? 'default'}</strong>)
              </div>
            );
          }
          return null; // Fail silently in production
        }

        return (
          // Critical boundary: prevents one bad section from crashing the whole page
          <SectionErrorBoundary key={section.id} sectionType={section.type}>
            {/* Suspense is required for React.lazy/Next.js dynamic imports */}
            <Suspense fallback={<SectionLoader />}>
              <SectionComponent 
                section={section} 
                globalData={globalData} 
              />
            </Suspense>
          </SectionErrorBoundary>
        );
      })}
    </div>
  );
}
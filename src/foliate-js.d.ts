declare module "foliate-js/view.js" {
  export type FoliateLocalizedValue = string | Record<string, string>;

  export type FoliateContributor = {
    name?: FoliateLocalizedValue;
  };

  export type FoliateTocItem = {
    label?: string;
    href?: string;
    subitems?: FoliateTocItem[];
  };

  export type FoliateBook = {
    metadata?: {
      title?: FoliateLocalizedValue;
      author?: FoliateContributor | FoliateContributor[] | FoliateLocalizedValue;
      language?: string | string[];
    };
    toc?: FoliateTocItem[];
    dir?: "ltr" | "rtl";
    rendition?: { layout?: string };
  };

  export type FoliateRelocateDetail = {
    fraction?: number;
    cfi?: string;
    tocItem?: FoliateTocItem;
    pageItem?: FoliateTocItem;
  };

  export class View extends HTMLElement {
    book: FoliateBook;
    renderer?: HTMLElement;
    isFixedLayout: boolean;
    lastLocation?: FoliateRelocateDetail;
    open(book: File | Blob | string | FoliateBook): Promise<void>;
    init(options: { lastLocation?: string; showTextStart?: boolean }): Promise<void>;
    close(): void;
    prev(distance?: number): Promise<void>;
    next(distance?: number): Promise<void>;
    goLeft(): Promise<void>;
    goRight(): Promise<void>;
    goTo(target: string | number | { fraction: number }): Promise<unknown>;
    goToFraction(fraction: number): Promise<void>;
  }
}

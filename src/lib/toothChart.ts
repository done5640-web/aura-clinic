/** FDI (ISO 3950) tooth numbering, the notation used across Europe. */
export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** A simplified tooth silhouette (crown + two roots), shared by the editor's chart and the PDF's. */
export const TOOTH_VIEWBOX = { width: 64, height: 88 };
export const TOOTH_PATH =
  "M32 3 C47 3 59 13 59 27 C59 38 53 45 49 49 C47 51 46 54 46 59 " +
  "L44.5 77 C44 83 40.5 85.5 37.5 85.5 C34.5 85.5 32.5 82.5 32 77.5 " +
  "L31 61 C30.8 58.5 29.2 58.5 29 61 L28 77.5 " +
  "C27.5 82.5 25.5 85.5 22.5 85.5 C19.5 85.5 16 83 15.5 77 " +
  "L14 59 C14 54 13 51 11 49 C7 45 1 38 1 27 C1 13 13 3 32 3 Z";

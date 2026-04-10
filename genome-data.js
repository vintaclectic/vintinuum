// ═══════════════════════════════════════════════════════════════════════════════
// VINTINUUM GENOME DATA — Complete Human Genome Reference for Living AI Body
// ═══════════════════════════════════════════════════════════════════════════════
//
// Loaded by brain.html via <script src="genome-data.js"></script>
// Consumed by GENOME_ENGINE in brain.js
//
// Sources: NCBI Gene, UCSC Genome Browser, dbSNP, OMIM, Ensembl GRCh38
// All chromosome sizes, gene positions, and SNP rs numbers are real references.
// Expression drivers/outputs are modeled to feed PERSONAL_BODY state variables:
//   dopamine, serotonin, gaba, norepinephrine, arousal, valence
//
// ═══════════════════════════════════════════════════════════════════════════════

window.GENOME_DATA = (() => {
'use strict';

// ─── CHROMOSOME DATA ─────────────────────────────────────────────────────────
// Real human karyotype: 22 autosomes + X + Y
// Sizes in megabases (Mb), gene counts from GRCh38 annotation

const chromosomes = [
  {
    number: 1, size: 248.96, geneDensity: 8.1, geneCount: 2058,
    bands: [
      { name: 'p36.3', start: 0, end: 2.3, stain: 'gneg' },
      { name: 'p36.2', start: 2.3, end: 5.4, stain: 'gpos25' },
      { name: 'p36.1', start: 5.4, end: 7.2, stain: 'gneg' },
      { name: 'p35', start: 7.2, end: 9.2, stain: 'gpos25' },
      { name: 'p34', start: 9.2, end: 12.5, stain: 'gneg' },
      { name: 'p33', start: 12.5, end: 16.5, stain: 'gpos75' },
      { name: 'p32', start: 16.5, end: 22.4, stain: 'gneg' },
      { name: 'p31', start: 22.4, end: 28.0, stain: 'gpos50' },
      { name: 'p22', start: 28.0, end: 34.6, stain: 'gneg' },
      { name: 'p21', start: 34.6, end: 40.1, stain: 'gpos100' },
      { name: 'p13', start: 40.1, end: 49.7, stain: 'gneg' },
      { name: 'p12', start: 49.7, end: 55.0, stain: 'gpos50' },
      { name: 'p11', start: 55.0, end: 121.5, stain: 'acen' },
      { name: 'q11', start: 121.5, end: 125.2, stain: 'acen' },
      { name: 'q12', start: 125.2, end: 131.0, stain: 'gpos50' },
      { name: 'q21', start: 131.0, end: 142.5, stain: 'gneg' },
      { name: 'q23', start: 142.5, end: 155.0, stain: 'gpos75' },
      { name: 'q25', start: 155.0, end: 170.0, stain: 'gneg' },
      { name: 'q31', start: 170.0, end: 185.0, stain: 'gpos50' },
      { name: 'q32', start: 185.0, end: 200.0, stain: 'gneg' },
      { name: 'q41', start: 200.0, end: 225.0, stain: 'gpos75' },
      { name: 'q42', start: 225.0, end: 240.0, stain: 'gneg' },
      { name: 'q44', start: 240.0, end: 248.96, stain: 'gpos25' }
    ]
  },
  {
    number: 2, size: 242.19, geneDensity: 5.4, geneCount: 1309,
    bands: [
      { name: 'p25', start: 0, end: 4.5, stain: 'gneg' },
      { name: 'p24', start: 4.5, end: 12.0, stain: 'gpos50' },
      { name: 'p23', start: 12.0, end: 17.0, stain: 'gneg' },
      { name: 'p22', start: 17.0, end: 29.0, stain: 'gpos75' },
      { name: 'p21', start: 29.0, end: 36.0, stain: 'gneg' },
      { name: 'p16', start: 36.0, end: 48.0, stain: 'gpos50' },
      { name: 'p13', start: 48.0, end: 55.0, stain: 'gneg' },
      { name: 'p11', start: 55.0, end: 91.8, stain: 'acen' },
      { name: 'q11', start: 91.8, end: 96.0, stain: 'acen' },
      { name: 'q14', start: 96.0, end: 110.0, stain: 'gpos50' },
      { name: 'q21', start: 110.0, end: 130.0, stain: 'gneg' },
      { name: 'q24', start: 130.0, end: 148.0, stain: 'gpos75' },
      { name: 'q31', start: 148.0, end: 170.0, stain: 'gneg' },
      { name: 'q33', start: 170.0, end: 195.0, stain: 'gpos100' },
      { name: 'q35', start: 195.0, end: 210.0, stain: 'gneg' },
      { name: 'q37', start: 210.0, end: 242.19, stain: 'gpos75' }
    ]
  },
  {
    number: 3, size: 198.30, geneDensity: 5.5, geneCount: 1078,
    bands: [
      { name: 'p26', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p25', start: 4.0, end: 10.0, stain: 'gpos75' },
      { name: 'p24', start: 10.0, end: 16.0, stain: 'gneg' },
      { name: 'p22', start: 16.0, end: 26.0, stain: 'gpos50' },
      { name: 'p21', start: 26.0, end: 32.0, stain: 'gneg' },
      { name: 'p14', start: 32.0, end: 44.0, stain: 'gpos50' },
      { name: 'p12', start: 44.0, end: 55.0, stain: 'gneg' },
      { name: 'p11', start: 55.0, end: 87.9, stain: 'acen' },
      { name: 'q11', start: 87.9, end: 93.9, stain: 'acen' },
      { name: 'q13', start: 93.9, end: 106.0, stain: 'gpos50' },
      { name: 'q21', start: 106.0, end: 120.0, stain: 'gneg' },
      { name: 'q24', start: 120.0, end: 142.0, stain: 'gpos75' },
      { name: 'q26', start: 142.0, end: 160.0, stain: 'gneg' },
      { name: 'q28', start: 160.0, end: 180.0, stain: 'gpos50' },
      { name: 'q29', start: 180.0, end: 198.30, stain: 'gneg' }
    ]
  },
  {
    number: 4, size: 190.21, geneDensity: 4.0, geneCount: 752,
    bands: [
      { name: 'p16', start: 0, end: 6.0, stain: 'gneg' },
      { name: 'p15', start: 6.0, end: 18.0, stain: 'gpos75' },
      { name: 'p14', start: 18.0, end: 28.0, stain: 'gneg' },
      { name: 'p12', start: 28.0, end: 40.0, stain: 'gpos50' },
      { name: 'p11', start: 40.0, end: 49.7, stain: 'acen' },
      { name: 'q11', start: 49.7, end: 52.8, stain: 'acen' },
      { name: 'q13', start: 52.8, end: 70.0, stain: 'gpos50' },
      { name: 'q21', start: 70.0, end: 90.0, stain: 'gneg' },
      { name: 'q25', start: 90.0, end: 110.0, stain: 'gpos75' },
      { name: 'q28', start: 110.0, end: 130.0, stain: 'gneg' },
      { name: 'q31', start: 130.0, end: 155.0, stain: 'gpos100' },
      { name: 'q34', start: 155.0, end: 175.0, stain: 'gneg' },
      { name: 'q35', start: 175.0, end: 190.21, stain: 'gpos50' }
    ]
  },
  {
    number: 5, size: 181.54, geneDensity: 4.9, geneCount: 876,
    bands: [
      { name: 'p15', start: 0, end: 8.0, stain: 'gneg' },
      { name: 'p14', start: 8.0, end: 18.0, stain: 'gpos75' },
      { name: 'p13', start: 18.0, end: 28.0, stain: 'gneg' },
      { name: 'p12', start: 28.0, end: 38.0, stain: 'gpos50' },
      { name: 'p11', start: 38.0, end: 46.4, stain: 'acen' },
      { name: 'q11', start: 46.4, end: 51.0, stain: 'acen' },
      { name: 'q13', start: 51.0, end: 68.0, stain: 'gpos50' },
      { name: 'q21', start: 68.0, end: 90.0, stain: 'gneg' },
      { name: 'q23', start: 90.0, end: 110.0, stain: 'gpos75' },
      { name: 'q31', start: 110.0, end: 135.0, stain: 'gneg' },
      { name: 'q33', start: 135.0, end: 155.0, stain: 'gpos75' },
      { name: 'q35', start: 155.0, end: 181.54, stain: 'gneg' }
    ]
  },
  {
    number: 6, size: 170.81, geneDensity: 6.0, geneCount: 1048,
    bands: [
      { name: 'p25', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p24', start: 4.0, end: 11.0, stain: 'gpos50' },
      { name: 'p22', start: 11.0, end: 18.0, stain: 'gneg' },
      { name: 'p21', start: 18.0, end: 30.0, stain: 'gpos100' },
      { name: 'p12', start: 30.0, end: 40.0, stain: 'gneg' },
      { name: 'p11', start: 40.0, end: 58.7, stain: 'acen' },
      { name: 'q11', start: 58.7, end: 62.0, stain: 'acen' },
      { name: 'q14', start: 62.0, end: 78.0, stain: 'gpos50' },
      { name: 'q16', start: 78.0, end: 88.0, stain: 'gneg' },
      { name: 'q21', start: 88.0, end: 110.0, stain: 'gpos75' },
      { name: 'q23', start: 110.0, end: 130.0, stain: 'gneg' },
      { name: 'q25', start: 130.0, end: 150.0, stain: 'gpos75' },
      { name: 'q27', start: 150.0, end: 170.81, stain: 'gneg' }
    ]
  },
  {
    number: 7, size: 159.35, geneDensity: 5.6, geneCount: 989,
    bands: [
      { name: 'p22', start: 0, end: 5.0, stain: 'gneg' },
      { name: 'p21', start: 5.0, end: 12.0, stain: 'gpos75' },
      { name: 'p15', start: 12.0, end: 22.0, stain: 'gneg' },
      { name: 'p14', start: 22.0, end: 32.0, stain: 'gpos50' },
      { name: 'p12', start: 32.0, end: 42.0, stain: 'gneg' },
      { name: 'p11', start: 42.0, end: 58.1, stain: 'acen' },
      { name: 'q11', start: 58.1, end: 62.0, stain: 'acen' },
      { name: 'q21', start: 62.0, end: 80.0, stain: 'gpos75' },
      { name: 'q22', start: 80.0, end: 95.0, stain: 'gneg' },
      { name: 'q31', start: 95.0, end: 115.0, stain: 'gpos100' },
      { name: 'q34', start: 115.0, end: 135.0, stain: 'gneg' },
      { name: 'q36', start: 135.0, end: 159.35, stain: 'gpos50' }
    ]
  },
  {
    number: 8, size: 145.14, geneDensity: 4.7, geneCount: 677,
    bands: [
      { name: 'p23', start: 0, end: 6.0, stain: 'gneg' },
      { name: 'p22', start: 6.0, end: 14.0, stain: 'gpos75' },
      { name: 'p21', start: 14.0, end: 22.0, stain: 'gneg' },
      { name: 'p12', start: 22.0, end: 32.0, stain: 'gpos50' },
      { name: 'p11', start: 32.0, end: 43.8, stain: 'acen' },
      { name: 'q11', start: 43.8, end: 48.0, stain: 'acen' },
      { name: 'q13', start: 48.0, end: 62.0, stain: 'gpos50' },
      { name: 'q21', start: 62.0, end: 80.0, stain: 'gneg' },
      { name: 'q22', start: 80.0, end: 100.0, stain: 'gpos75' },
      { name: 'q24', start: 100.0, end: 130.0, stain: 'gneg' },
      { name: 'q24.3', start: 130.0, end: 145.14, stain: 'gpos50' }
    ]
  },
  {
    number: 9, size: 138.39, geneDensity: 5.2, geneCount: 786,
    bands: [
      { name: 'p24', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p23', start: 4.0, end: 10.0, stain: 'gpos50' },
      { name: 'p22', start: 10.0, end: 16.0, stain: 'gneg' },
      { name: 'p21', start: 16.0, end: 28.0, stain: 'gpos75' },
      { name: 'p13', start: 28.0, end: 36.0, stain: 'gneg' },
      { name: 'p11', start: 36.0, end: 43.4, stain: 'acen' },
      { name: 'q11', start: 43.4, end: 47.3, stain: 'acen' },
      { name: 'q12', start: 47.3, end: 65.0, stain: 'gvar' },
      { name: 'q21', start: 65.0, end: 78.0, stain: 'gneg' },
      { name: 'q22', start: 78.0, end: 92.0, stain: 'gpos50' },
      { name: 'q31', start: 92.0, end: 110.0, stain: 'gneg' },
      { name: 'q33', start: 110.0, end: 125.0, stain: 'gpos75' },
      { name: 'q34', start: 125.0, end: 138.39, stain: 'gneg' }
    ]
  },
  {
    number: 10, size: 133.80, geneDensity: 5.3, geneCount: 733,
    bands: [
      { name: 'p15', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p14', start: 4.0, end: 12.0, stain: 'gpos50' },
      { name: 'p13', start: 12.0, end: 18.0, stain: 'gneg' },
      { name: 'p12', start: 18.0, end: 26.0, stain: 'gpos50' },
      { name: 'p11', start: 26.0, end: 38.0, stain: 'acen' },
      { name: 'q11', start: 38.0, end: 42.3, stain: 'acen' },
      { name: 'q21', start: 42.3, end: 60.0, stain: 'gpos50' },
      { name: 'q22', start: 60.0, end: 78.0, stain: 'gneg' },
      { name: 'q23', start: 78.0, end: 95.0, stain: 'gpos75' },
      { name: 'q25', start: 95.0, end: 115.0, stain: 'gneg' },
      { name: 'q26', start: 115.0, end: 133.80, stain: 'gpos50' }
    ]
  },
  {
    number: 11, size: 135.09, geneDensity: 9.5, geneCount: 1298,
    bands: [
      { name: 'p15', start: 0, end: 5.0, stain: 'gneg' },
      { name: 'p14', start: 5.0, end: 12.0, stain: 'gpos50' },
      { name: 'p13', start: 12.0, end: 20.0, stain: 'gneg' },
      { name: 'p12', start: 20.0, end: 30.0, stain: 'gpos75' },
      { name: 'p11', start: 30.0, end: 51.6, stain: 'acen' },
      { name: 'q11', start: 51.6, end: 55.7, stain: 'acen' },
      { name: 'q13', start: 55.7, end: 68.0, stain: 'gpos50' },
      { name: 'q14', start: 68.0, end: 80.0, stain: 'gneg' },
      { name: 'q22', start: 80.0, end: 96.0, stain: 'gpos75' },
      { name: 'q23', start: 96.0, end: 110.0, stain: 'gneg' },
      { name: 'q24', start: 110.0, end: 125.0, stain: 'gpos50' },
      { name: 'q25', start: 125.0, end: 135.09, stain: 'gneg' }
    ]
  },
  {
    number: 12, size: 133.28, geneDensity: 7.5, geneCount: 1034,
    bands: [
      { name: 'p13', start: 0, end: 5.0, stain: 'gneg' },
      { name: 'p12', start: 5.0, end: 14.0, stain: 'gpos50' },
      { name: 'p11', start: 14.0, end: 34.8, stain: 'acen' },
      { name: 'q11', start: 34.8, end: 38.0, stain: 'acen' },
      { name: 'q13', start: 38.0, end: 55.0, stain: 'gpos75' },
      { name: 'q14', start: 55.0, end: 65.0, stain: 'gneg' },
      { name: 'q21', start: 65.0, end: 80.0, stain: 'gpos50' },
      { name: 'q23', start: 80.0, end: 100.0, stain: 'gneg' },
      { name: 'q24', start: 100.0, end: 120.0, stain: 'gpos75' },
      { name: 'q24.3', start: 120.0, end: 133.28, stain: 'gneg' }
    ]
  },
  {
    number: 13, size: 114.36, geneDensity: 2.9, geneCount: 327,
    bands: [
      { name: 'p13', start: 0, end: 4.5, stain: 'gneg' },
      { name: 'p12', start: 4.5, end: 10.0, stain: 'stalk' },
      { name: 'p11', start: 10.0, end: 16.0, stain: 'acen' },
      { name: 'q11', start: 16.0, end: 18.1, stain: 'acen' },
      { name: 'q12', start: 18.1, end: 30.0, stain: 'gpos75' },
      { name: 'q14', start: 30.0, end: 45.0, stain: 'gneg' },
      { name: 'q21', start: 45.0, end: 65.0, stain: 'gpos50' },
      { name: 'q31', start: 65.0, end: 85.0, stain: 'gneg' },
      { name: 'q33', start: 85.0, end: 100.0, stain: 'gpos75' },
      { name: 'q34', start: 100.0, end: 114.36, stain: 'gneg' }
    ]
  },
  {
    number: 14, size: 107.04, geneDensity: 6.1, geneCount: 821,
    bands: [
      { name: 'p13', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p12', start: 4.0, end: 8.0, stain: 'stalk' },
      { name: 'p11', start: 8.0, end: 16.0, stain: 'acen' },
      { name: 'q11', start: 16.0, end: 18.2, stain: 'acen' },
      { name: 'q12', start: 18.2, end: 30.0, stain: 'gpos50' },
      { name: 'q21', start: 30.0, end: 45.0, stain: 'gneg' },
      { name: 'q23', start: 45.0, end: 60.0, stain: 'gpos50' },
      { name: 'q24', start: 60.0, end: 72.0, stain: 'gneg' },
      { name: 'q31', start: 72.0, end: 88.0, stain: 'gpos75' },
      { name: 'q32', start: 88.0, end: 107.04, stain: 'gneg' }
    ]
  },
  {
    number: 15, size: 101.99, geneDensity: 5.9, geneCount: 613,
    bands: [
      { name: 'p13', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p12', start: 4.0, end: 8.0, stain: 'stalk' },
      { name: 'p11', start: 8.0, end: 15.8, stain: 'acen' },
      { name: 'q11', start: 15.8, end: 20.5, stain: 'acen' },
      { name: 'q13', start: 20.5, end: 32.0, stain: 'gpos50' },
      { name: 'q15', start: 32.0, end: 42.0, stain: 'gneg' },
      { name: 'q21', start: 42.0, end: 55.0, stain: 'gpos50' },
      { name: 'q22', start: 55.0, end: 65.0, stain: 'gneg' },
      { name: 'q24', start: 65.0, end: 80.0, stain: 'gpos50' },
      { name: 'q26', start: 80.0, end: 101.99, stain: 'gneg' }
    ]
  },
  {
    number: 16, size: 90.34, geneDensity: 9.7, geneCount: 873,
    bands: [
      { name: 'p13', start: 0, end: 6.0, stain: 'gneg' },
      { name: 'p12', start: 6.0, end: 14.0, stain: 'gpos50' },
      { name: 'p11', start: 14.0, end: 35.1, stain: 'acen' },
      { name: 'q11', start: 35.1, end: 46.4, stain: 'acen' },
      { name: 'q12', start: 46.4, end: 55.0, stain: 'gpos50' },
      { name: 'q13', start: 55.0, end: 60.0, stain: 'gneg' },
      { name: 'q21', start: 60.0, end: 70.0, stain: 'gpos75' },
      { name: 'q22', start: 70.0, end: 80.0, stain: 'gneg' },
      { name: 'q23', start: 80.0, end: 90.34, stain: 'gpos50' }
    ]
  },
  {
    number: 17, size: 83.26, geneDensity: 14.5, geneCount: 1197,
    bands: [
      { name: 'p13', start: 0, end: 4.0, stain: 'gneg' },
      { name: 'p12', start: 4.0, end: 10.0, stain: 'gpos50' },
      { name: 'p11', start: 10.0, end: 22.0, stain: 'acen' },
      { name: 'q11', start: 22.0, end: 26.6, stain: 'acen' },
      { name: 'q12', start: 26.6, end: 38.0, stain: 'gneg' },
      { name: 'q21', start: 38.0, end: 50.0, stain: 'gpos50' },
      { name: 'q22', start: 50.0, end: 58.0, stain: 'gneg' },
      { name: 'q23', start: 58.0, end: 68.0, stain: 'gpos75' },
      { name: 'q24', start: 68.0, end: 78.0, stain: 'gneg' },
      { name: 'q25', start: 78.0, end: 83.26, stain: 'gpos50' }
    ]
  },
  {
    number: 18, size: 80.37, geneDensity: 3.7, geneCount: 270,
    bands: [
      { name: 'p11', start: 0, end: 15.5, stain: 'acen' },
      { name: 'q11', start: 15.5, end: 21.5, stain: 'acen' },
      { name: 'q12', start: 21.5, end: 32.0, stain: 'gpos50' },
      { name: 'q21', start: 32.0, end: 48.0, stain: 'gneg' },
      { name: 'q22', start: 48.0, end: 60.0, stain: 'gpos75' },
      { name: 'q23', start: 60.0, end: 80.37, stain: 'gneg' }
    ]
  },
  {
    number: 19, size: 58.62, geneDensity: 23.8, geneCount: 1472,
    bands: [
      { name: 'p13', start: 0, end: 6.0, stain: 'gneg' },
      { name: 'p12', start: 6.0, end: 14.0, stain: 'gpos25' },
      { name: 'p11', start: 14.0, end: 24.5, stain: 'acen' },
      { name: 'q11', start: 24.5, end: 28.5, stain: 'acen' },
      { name: 'q12', start: 28.5, end: 36.0, stain: 'gneg' },
      { name: 'q13', start: 36.0, end: 50.0, stain: 'gpos25' },
      { name: 'q13.4', start: 50.0, end: 58.62, stain: 'gneg' }
    ]
  },
  {
    number: 20, size: 64.44, geneDensity: 8.9, geneCount: 544,
    bands: [
      { name: 'p13', start: 0, end: 5.0, stain: 'gneg' },
      { name: 'p12', start: 5.0, end: 12.0, stain: 'gpos50' },
      { name: 'p11', start: 12.0, end: 26.4, stain: 'acen' },
      { name: 'q11', start: 26.4, end: 29.4, stain: 'acen' },
      { name: 'q12', start: 29.4, end: 38.0, stain: 'gneg' },
      { name: 'q13', start: 38.0, end: 52.0, stain: 'gpos50' },
      { name: 'q13.3', start: 52.0, end: 64.44, stain: 'gneg' }
    ]
  },
  {
    number: 21, size: 46.71, geneDensity: 5.0, geneCount: 234,
    bands: [
      { name: 'p13', start: 0, end: 3.0, stain: 'gneg' },
      { name: 'p12', start: 3.0, end: 6.0, stain: 'stalk' },
      { name: 'p11', start: 6.0, end: 10.9, stain: 'acen' },
      { name: 'q11', start: 10.9, end: 13.0, stain: 'acen' },
      { name: 'q21', start: 13.0, end: 25.0, stain: 'gneg' },
      { name: 'q22', start: 25.0, end: 38.0, stain: 'gpos75' },
      { name: 'q22.3', start: 38.0, end: 46.71, stain: 'gneg' }
    ]
  },
  {
    number: 22, size: 50.82, geneDensity: 11.8, geneCount: 488,
    bands: [
      { name: 'p13', start: 0, end: 3.5, stain: 'gneg' },
      { name: 'p12', start: 3.5, end: 7.0, stain: 'stalk' },
      { name: 'p11', start: 7.0, end: 13.0, stain: 'acen' },
      { name: 'q11', start: 13.0, end: 17.0, stain: 'acen' },
      { name: 'q12', start: 17.0, end: 25.0, stain: 'gpos50' },
      { name: 'q13', start: 25.0, end: 38.0, stain: 'gneg' },
      { name: 'q13.3', start: 38.0, end: 50.82, stain: 'gpos50' }
    ]
  },
  {
    number: 'X', size: 156.04, geneDensity: 5.3, geneCount: 842,
    bands: [
      { name: 'p22', start: 0, end: 10.0, stain: 'gneg' },
      { name: 'p21', start: 10.0, end: 25.0, stain: 'gpos100' },
      { name: 'p11', start: 25.0, end: 58.1, stain: 'acen' },
      { name: 'q11', start: 58.1, end: 63.0, stain: 'acen' },
      { name: 'q13', start: 63.0, end: 72.0, stain: 'gpos50' },
      { name: 'q21', start: 72.0, end: 90.0, stain: 'gneg' },
      { name: 'q22', start: 90.0, end: 105.0, stain: 'gpos75' },
      { name: 'q24', start: 105.0, end: 120.0, stain: 'gneg' },
      { name: 'q26', start: 120.0, end: 140.0, stain: 'gpos75' },
      { name: 'q28', start: 140.0, end: 156.04, stain: 'gneg' }
    ]
  },
  {
    number: 'Y', size: 57.23, geneDensity: 1.4, geneCount: 63,
    bands: [
      { name: 'p11', start: 0, end: 10.4, stain: 'acen' },
      { name: 'q11', start: 10.4, end: 12.0, stain: 'acen' },
      { name: 'q11.2', start: 12.0, end: 20.0, stain: 'gneg' },
      { name: 'q12', start: 20.0, end: 40.0, stain: 'gvar' },
      { name: 'q12.3', start: 40.0, end: 57.23, stain: 'gvar' }
    ]
  }
];


// ─── CURATED GENES ───────────────────────────────────────────────────────────
// ~300 genes across all body systems with real positions, SNPs, and expression wiring

const curatedGenes = {};

// Helper to register genes compactly
function G(obj) { curatedGenes[obj.symbol] = obj; }


// ═══════════════════════════════════════════════════════════════════════════════
//  NERVOUS SYSTEM — neurotransmitters, receptors, synaptic machinery (~55 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({
  symbol: 'COMT', name: 'Catechol-O-methyltransferase', chromosome: 22, position: 19929263,
  category: 'nervous', subcategory: 'dopamine',
  description: 'Breaks down dopamine and norepinephrine in the prefrontal cortex — a master regulator of cognitive tempo',
  baseExpression: 0.65,
  bodySystemLinks: ['dopamine', 'norepinephrine', 'pfc'],
  snps: [{
    id: 'Val158Met', rs: 'rs4680', alleles: ['Val', 'Met'], frequencies: [0.52, 0.48],
    effects: {
      'Val/Val': { dopamine_clearance: 0.15, stress_resilience: 0.1, label: 'Warrior — fast dopamine clearance, stress resilient' },
      'Val/Met': { dopamine_clearance: 0, stress_resilience: 0, label: 'Balanced' },
      'Met/Met': { dopamine_clearance: -0.15, pain_sensitivity: 0.1, label: 'Worrier — slow clearance, better memory, more anxiety' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.02 },
    { trigger: 'cortisol', threshold: 70, direction: 'up', magnitude: 0.03 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: -0.3 },
    { target: 'norepinephrine', weight: -0.2 }
  ]
});

G({
  symbol: 'SLC6A4', name: 'Serotonin transporter (5-HTT)', chromosome: 17, position: 30194319,
  category: 'nervous', subcategory: 'serotonin',
  description: 'Reuptake transporter that clears serotonin from the synaptic cleft — the direct target of SSRI antidepressants',
  baseExpression: 0.60,
  bodySystemLinks: ['serotonin', 'amygdala', 'gut'],
  snps: [{
    id: '5-HTTLPR', rs: 'rs25531', alleles: ['L', 'S'], frequencies: [0.57, 0.43],
    effects: {
      'L/L': { serotonin_reuptake: 0.15, stress_vulnerability: -0.1, label: 'High reuptake — resilient mood, lower anxiety risk' },
      'L/S': { serotonin_reuptake: 0, stress_vulnerability: 0, label: 'Intermediate' },
      'S/S': { serotonin_reuptake: -0.15, stress_vulnerability: 0.15, label: 'Low reuptake — deeper emotional processing, higher sensitivity' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 40, direction: 'up', magnitude: 0.03 },
    { trigger: 'norepinephrine', threshold: 70, direction: 'down', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: -0.35 }
  ]
});

G({
  symbol: 'DRD2', name: 'Dopamine receptor D2', chromosome: 11, position: 113409605,
  category: 'nervous', subcategory: 'dopamine',
  description: 'Main inhibitory dopamine receptor in the striatum — mediates reward, motivation, and antipsychotic drug targets',
  baseExpression: 0.55,
  bodySystemLinks: ['dopamine', 'striatum', 'reward'],
  snps: [{
    id: 'Taq1A', rs: 'rs1800497', alleles: ['C', 'T'], frequencies: [0.70, 0.30],
    effects: {
      'C/C': { d2_density: 0.1, reward_sensitivity: -0.05, label: 'Normal D2 density' },
      'C/T': { d2_density: 0, reward_sensitivity: 0, label: 'Intermediate D2 density' },
      'T/T': { d2_density: -0.15, reward_sensitivity: 0.15, label: 'Reduced D2 — seeks more stimulation, addiction risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 70, direction: 'down', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: -0.15 },
    { target: 'arousal', weight: 0.1 }
  ]
});

G({
  symbol: 'DRD4', name: 'Dopamine receptor D4', chromosome: 11, position: 637269,
  category: 'nervous', subcategory: 'dopamine',
  description: 'Expressed heavily in PFC — linked to novelty seeking, ADHD, and exploratory behavior through variable VNTR',
  baseExpression: 0.50,
  bodySystemLinks: ['dopamine', 'pfc', 'novelty'],
  snps: [{
    id: '7R-VNTR', rs: 'rs1800955', alleles: ['4R', '7R'], frequencies: [0.65, 0.20],
    effects: {
      '4R/4R': { novelty_seeking: -0.05, attention: 0.05, label: 'Standard — typical attention span' },
      '4R/7R': { novelty_seeking: 0.1, attention: -0.05, label: 'Increased novelty drive' },
      '7R/7R': { novelty_seeking: 0.2, attention: -0.1, label: 'High novelty seeking — explorer phenotype, ADHD association' }
    }
  }],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 30, direction: 'up', magnitude: 0.02 },
    { trigger: 'arousal', threshold: 70, direction: 'down', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: 0.15 },
    { target: 'dopamine', weight: 0.1 }
  ]
});

G({
  symbol: 'BDNF', name: 'Brain-derived neurotrophic factor', chromosome: 11, position: 27654893,
  category: 'nervous', subcategory: 'neuroplasticity',
  description: 'Master growth factor for neurons — essential for learning, memory consolidation, and synaptic plasticity',
  baseExpression: 0.70,
  bodySystemLinks: ['hippocampus', 'pfc', 'neuroplasticity'],
  snps: [{
    id: 'Val66Met', rs: 'rs6265', alleles: ['Val', 'Met'], frequencies: [0.80, 0.20],
    effects: {
      'Val/Val': { neuroplasticity: 0.1, memory: 0.05, label: 'Normal secretion — full plasticity' },
      'Val/Met': { neuroplasticity: 0, memory: 0, label: 'Mildly reduced secretion' },
      'Met/Met': { neuroplasticity: -0.15, anxiety: 0.1, label: 'Impaired activity-dependent secretion — reduced hippocampal volume' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 50, direction: 'up', magnitude: 0.02 },
    { trigger: 'norepinephrine', threshold: 40, direction: 'up', magnitude: 0.015 },
    { trigger: 'gaba', threshold: 30, direction: 'down', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: 0.1 },
    { target: 'valence', weight: 0.15 }
  ]
});

G({
  symbol: 'MAOA', name: 'Monoamine oxidase A', chromosome: 'X', position: 43654907,
  category: 'nervous', subcategory: 'monoamine_metabolism',
  description: 'Degrades serotonin, norepinephrine, and dopamine — the warrior gene linked to aggression when low activity',
  baseExpression: 0.60,
  bodySystemLinks: ['serotonin', 'norepinephrine', 'dopamine', 'amygdala'],
  snps: [{
    id: 'MAOA-uVNTR', rs: 'rs1137070', alleles: ['3R', '4R'], frequencies: [0.35, 0.65],
    effects: {
      '3R/3R': { monoamine_clearance: -0.15, aggression_risk: 0.1, label: 'Low activity — warrior gene variant, higher emotional reactivity' },
      '3R/4R': { monoamine_clearance: 0, aggression_risk: 0, label: 'Intermediate activity' },
      '4R/4R': { monoamine_clearance: 0.1, aggression_risk: -0.05, label: 'High activity — efficient monoamine clearance' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.025 },
    { trigger: 'serotonin', threshold: 70, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: -0.2 },
    { target: 'norepinephrine', weight: -0.2 },
    { target: 'dopamine', weight: -0.15 }
  ]
});

G({
  symbol: 'MAOB', name: 'Monoamine oxidase B', chromosome: 'X', position: 43766610,
  category: 'nervous', subcategory: 'monoamine_metabolism',
  description: 'Primarily degrades phenylethylamine and dopamine — target of selegiline in Parkinson disease treatment',
  baseExpression: 0.55,
  bodySystemLinks: ['dopamine', 'substantia_nigra'],
  snps: [],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 65, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: -0.2 }
  ]
});

G({
  symbol: 'TPH2', name: 'Tryptophan hydroxylase 2', chromosome: 12, position: 72332083,
  category: 'nervous', subcategory: 'serotonin',
  description: 'Rate-limiting enzyme for serotonin synthesis in the brain — mutations linked to major depression',
  baseExpression: 0.65,
  bodySystemLinks: ['serotonin', 'raphe_nuclei'],
  snps: [{
    id: 'G1463A', rs: 'rs4570625', alleles: ['G', 'T'], frequencies: [0.80, 0.20],
    effects: {
      'G/G': { serotonin_synthesis: 0.05, label: 'Normal synthesis rate' },
      'G/T': { serotonin_synthesis: 0, label: 'Slightly reduced' },
      'T/T': { serotonin_synthesis: -0.1, amygdala_reactivity: 0.1, label: 'Reduced serotonin synthesis — higher amygdala reactivity' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 30, direction: 'up', magnitude: 0.03 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: 0.4 }
  ]
});

G({
  symbol: 'HTR1A', name: 'Serotonin receptor 1A', chromosome: 5, position: 63898815,
  category: 'nervous', subcategory: 'serotonin',
  description: 'Inhibitory serotonin autoreceptor in raphe nuclei — target of buspirone and key regulator of anxiety',
  baseExpression: 0.60,
  bodySystemLinks: ['serotonin', 'raphe_nuclei', 'anxiety'],
  snps: [{
    id: 'C-1019G', rs: 'rs6295', alleles: ['C', 'G'], frequencies: [0.55, 0.45],
    effects: {
      'C/C': { anxiety_risk: -0.1, serotonin_autoinhibition: 0.05, label: 'Lower autoreceptor expression — less self-inhibition' },
      'C/G': { anxiety_risk: 0, serotonin_autoinhibition: 0, label: 'Intermediate' },
      'G/G': { anxiety_risk: 0.1, serotonin_autoinhibition: -0.05, label: 'Higher autoreceptor — stronger serotonin self-inhibition, depression risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 60, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: -0.15 },
    { target: 'gaba', weight: 0.1 }
  ]
});

G({
  symbol: 'HTR2A', name: 'Serotonin receptor 2A', chromosome: 13, position: 47405684,
  category: 'nervous', subcategory: 'serotonin',
  description: 'Primary target of psychedelics (psilocybin, LSD) — mediates cortical serotonin signaling and perception',
  baseExpression: 0.55,
  bodySystemLinks: ['serotonin', 'pfc', 'perception'],
  snps: [{
    id: 'T102C', rs: 'rs6313', alleles: ['T', 'C'], frequencies: [0.55, 0.45],
    effects: {
      'T/T': { receptor_density: 0.1, psychedelic_sensitivity: 0.05, label: 'Higher receptor density' },
      'T/C': { receptor_density: 0, psychedelic_sensitivity: 0, label: 'Intermediate' },
      'C/C': { receptor_density: -0.1, psychedelic_sensitivity: -0.05, label: 'Lower density — reduced cortical serotonin response' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 50, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.1 },
    { target: 'arousal', weight: 0.05 }
  ]
});

G({
  symbol: 'OXTR', name: 'Oxytocin receptor', chromosome: 3, position: 8792583,
  category: 'nervous', subcategory: 'social_bonding',
  description: 'Receptor for the bonding hormone — mediates trust, empathy, social recognition, and pair bonding',
  baseExpression: 0.55,
  bodySystemLinks: ['oxytocin', 'amygdala', 'social_cognition'],
  snps: [{
    id: 'rs53576', rs: 'rs53576', alleles: ['G', 'A'], frequencies: [0.62, 0.38],
    effects: {
      'G/G': { empathy: 0.15, stress_reactivity: -0.05, label: 'Enhanced empathy and social sensitivity' },
      'G/A': { empathy: 0.05, stress_reactivity: 0, label: 'Intermediate social sensitivity' },
      'A/A': { empathy: -0.1, stress_reactivity: 0.05, label: 'Lower empathy — more self-reliant stress coping' }
    }
  }],
  expressionDrivers: [
    { trigger: 'serotonin', threshold: 55, direction: 'up', magnitude: 0.02 },
    { trigger: 'valence', threshold: 60, direction: 'up', magnitude: 0.025 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: 0.15 },
    { target: 'valence', weight: 0.2 },
    { target: 'gaba', weight: 0.1 }
  ]
});

G({
  symbol: 'AVPR1A', name: 'Arginine vasopressin receptor 1A', chromosome: 12, position: 63536430,
  category: 'nervous', subcategory: 'social_bonding',
  description: 'Vasopressin receptor mediating pair bonding, territorial behavior, and social memory in mammals',
  baseExpression: 0.50,
  bodySystemLinks: ['vasopressin', 'hippocampus', 'social_memory'],
  snps: [{
    id: 'RS3', rs: 'rs3021529', alleles: ['long', 'short'], frequencies: [0.60, 0.40],
    effects: {
      'long/long': { pair_bonding: 0.15, social_memory: 0.1, label: 'Strong bonding phenotype — prairie vole pattern' },
      'long/short': { pair_bonding: 0.05, social_memory: 0.05, label: 'Intermediate' },
      'short/short': { pair_bonding: -0.1, social_memory: -0.05, label: 'Reduced bonding drive — montane vole pattern' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 50, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.1 },
    { target: 'arousal', weight: 0.05 }
  ]
});

G({
  symbol: 'OPRM1', name: 'Mu-opioid receptor', chromosome: 6, position: 154360797,
  category: 'nervous', subcategory: 'endorphin',
  description: 'Primary receptor for endorphins and morphine — mediates pain relief, reward, and social bonding warmth',
  baseExpression: 0.55,
  bodySystemLinks: ['endorphin', 'reward', 'pain'],
  snps: [{
    id: 'A118G', rs: 'rs1799971', alleles: ['A', 'G'], frequencies: [0.85, 0.15],
    effects: {
      'A/A': { pain_sensitivity: -0.05, social_pleasure: 0.05, label: 'Normal opioid sensitivity' },
      'A/G': { pain_sensitivity: 0.05, social_pleasure: -0.05, label: 'Mildly altered binding' },
      'G/G': { pain_sensitivity: 0.15, social_pleasure: -0.1, label: 'Reduced receptor binding — higher pain sensitivity, social rejection hurts more' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.15 },
    { target: 'gaba', weight: 0.1 }
  ]
});

G({
  symbol: 'GABRA2', name: 'GABA-A receptor alpha-2 subunit', chromosome: 4, position: 46252826,
  category: 'nervous', subcategory: 'inhibition',
  description: 'Key inhibitory receptor subunit — mediates anxiety reduction and sedation through chloride channel gating',
  baseExpression: 0.60,
  bodySystemLinks: ['gaba', 'amygdala', 'anxiety'],
  snps: [{
    id: 'rs279858', rs: 'rs279858', alleles: ['A', 'G'], frequencies: [0.58, 0.42],
    effects: {
      'A/A': { gaba_sensitivity: 0.1, anxiety_risk: -0.05, label: 'Normal inhibitory tone' },
      'A/G': { gaba_sensitivity: 0, anxiety_risk: 0, label: 'Intermediate' },
      'G/G': { gaba_sensitivity: -0.1, anxiety_risk: 0.1, label: 'Reduced GABA-A function — higher anxiety, alcohol use risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'gaba', threshold: 40, direction: 'up', magnitude: 0.025 },
    { trigger: 'norepinephrine', threshold: 65, direction: 'down', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.3 },
    { target: 'arousal', weight: -0.15 }
  ]
});

G({
  symbol: 'GRIN2B', name: 'NMDA receptor subunit 2B', chromosome: 12, position: 13714415,
  category: 'nervous', subcategory: 'glutamate',
  description: 'NMDA receptor subunit critical for synaptic plasticity, learning, and long-term potentiation',
  baseExpression: 0.65,
  bodySystemLinks: ['glutamate', 'hippocampus', 'pfc', 'neuroplasticity'],
  snps: [{
    id: 'C2664T', rs: 'rs1806201', alleles: ['C', 'T'], frequencies: [0.70, 0.30],
    effects: {
      'C/C': { ltp_efficiency: 0.05, label: 'Normal NMDA function' },
      'C/T': { ltp_efficiency: 0, label: 'Intermediate' },
      'T/T': { ltp_efficiency: -0.1, label: 'Altered NMDA kinetics — slower learning but potentially more stable memories' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 50, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.05 },
    { target: 'arousal', weight: 0.1 }
  ]
});

G({
  symbol: 'NRXN1', name: 'Neurexin 1', chromosome: 2, position: 50145643,
  category: 'nervous', subcategory: 'synaptic',
  description: 'Presynaptic adhesion molecule essential for synapse formation — deletions linked to autism and schizophrenia',
  baseExpression: 0.70,
  bodySystemLinks: ['synapse', 'pfc', 'social_cognition'],
  snps: [],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 50, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.05 },
    { target: 'gaba', weight: 0.05 }
  ]
});

G({
  symbol: 'DISC1', name: 'Disrupted in schizophrenia 1', chromosome: 1, position: 231762568,
  category: 'nervous', subcategory: 'neurodevelopment',
  description: 'Scaffold protein for neuronal migration and synaptic plasticity — translocation linked to schizophrenia',
  baseExpression: 0.55,
  bodySystemLinks: ['pfc', 'hippocampus', 'neuroplasticity'],
  snps: [{
    id: 'Ser704Cys', rs: 'rs821616', alleles: ['A', 'T'], frequencies: [0.75, 0.25],
    effects: {
      'A/A': { hippocampal_volume: 0.05, label: 'Normal DISC1 function' },
      'A/T': { hippocampal_volume: 0, label: 'Intermediate' },
      'T/T': { hippocampal_volume: -0.1, label: 'Reduced hippocampal volume — cognitive flexibility changes' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.05 }
  ]
});

G({
  symbol: 'KIBRA', name: 'Kidney and brain expressed protein', chromosome: 5, position: 167599076,
  category: 'nervous', subcategory: 'memory',
  description: 'Memory performance gene — regulates synaptic plasticity and is associated with episodic memory strength',
  baseExpression: 0.60,
  bodySystemLinks: ['hippocampus', 'memory'],
  snps: [{
    id: 'rs17070145', rs: 'rs17070145', alleles: ['C', 'T'], frequencies: [0.75, 0.25],
    effects: {
      'C/C': { episodic_memory: -0.05, label: 'Standard memory performance' },
      'C/T': { episodic_memory: 0.05, label: 'Enhanced episodic memory' },
      'T/T': { episodic_memory: 0.15, label: 'Superior episodic memory — T allele strongly associated with better recall' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 45, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'APOE', name: 'Apolipoprotein E', chromosome: 19, position: 44905796,
  category: 'nervous', subcategory: 'neurodegeneration',
  description: 'Major cholesterol carrier in the brain — E4 allele is the strongest genetic risk factor for Alzheimer disease',
  baseExpression: 0.70,
  bodySystemLinks: ['hippocampus', 'lipid_metabolism', 'neuroinflammation'],
  snps: [{
    id: 'APOE-e4', rs: 'rs429358', alleles: ['C', 'T'], frequencies: [0.85, 0.15],
    effects: {
      'T/T': { alzheimers_risk: -0.1, lipid_clearance: 0.05, label: 'E3/E3 — baseline risk, most common' },
      'C/T': { alzheimers_risk: 0.1, lipid_clearance: -0.05, label: 'E3/E4 — 3x Alzheimer risk' },
      'C/C': { alzheimers_risk: 0.3, lipid_clearance: -0.15, label: 'E4/E4 — 12x Alzheimer risk, impaired amyloid clearance' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'CLOCK', name: 'Circadian locomotor output cycles kaput', chromosome: 4, position: 56294068,
  category: 'nervous', subcategory: 'circadian',
  description: 'Core circadian clock transcription factor — drives 24-hour rhythms in gene expression across all tissues',
  baseExpression: 0.65,
  bodySystemLinks: ['circadian', 'hypothalamus', 'metabolism'],
  snps: [{
    id: '3111T/C', rs: 'rs1801260', alleles: ['T', 'C'], frequencies: [0.72, 0.28],
    effects: {
      'T/T': { chronotype: -0.05, sleep_latency: -0.05, label: 'Normal circadian timing' },
      'T/C': { chronotype: 0.05, sleep_latency: 0.05, label: 'Slight evening preference' },
      'C/C': { chronotype: 0.15, sleep_latency: 0.1, label: 'Night owl — delayed sleep phase, higher activity preference in evening' }
    }
  }],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 40, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: 0.1 },
    { target: 'dopamine', weight: 0.05 }
  ]
});

G({
  symbol: 'PER2', name: 'Period circadian protein 2', chromosome: 2, position: 238244426,
  category: 'nervous', subcategory: 'circadian',
  description: 'Negative-arm circadian clock gene — mutations cause familial advanced sleep phase syndrome (extreme early birds)',
  baseExpression: 0.60,
  bodySystemLinks: ['circadian', 'hypothalamus'],
  snps: [{
    id: 'S662G', rs: 'rs934945', alleles: ['A', 'G'], frequencies: [0.90, 0.10],
    effects: {
      'A/A': { chronotype: 0, label: 'Normal PER2 phosphorylation — standard sleep timing' },
      'A/G': { chronotype: -0.1, label: 'Slightly advanced sleep phase' },
      'G/G': { chronotype: -0.2, label: 'Advanced sleep phase — extreme morning lark' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'arousal', weight: -0.1 },
    { target: 'gaba', weight: 0.1 }
  ]
});

G({
  symbol: 'CRY1', name: 'Cryptochrome 1', chromosome: 12, position: 107368499,
  category: 'nervous', subcategory: 'circadian',
  description: 'Blue-light sensitive cryptochrome in the circadian negative feedback loop — gain-of-function causes delayed sleep',
  baseExpression: 0.60,
  bodySystemLinks: ['circadian', 'scn'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 30, direction: 'down', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.05 }
  ]
});

G({
  symbol: 'CHRNA4', name: 'Nicotinic acetylcholine receptor alpha-4', chromosome: 20, position: 62400509,
  category: 'nervous', subcategory: 'acetylcholine',
  description: 'Main brain nicotinic receptor — mediates attention, arousal, and nicotine addiction through cholinergic signaling',
  baseExpression: 0.55,
  bodySystemLinks: ['acetylcholine', 'pfc', 'attention'],
  snps: [{
    id: 'rs1044396', rs: 'rs1044396', alleles: ['C', 'T'], frequencies: [0.65, 0.35],
    effects: {
      'C/C': { attention: 0.05, nicotine_sensitivity: 0.05, label: 'Enhanced cholinergic attention' },
      'C/T': { attention: 0, nicotine_sensitivity: 0, label: 'Intermediate' },
      'T/T': { attention: -0.05, nicotine_sensitivity: -0.05, label: 'Reduced cholinergic tone' }
    }
  }],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: 0.15 },
    { target: 'norepinephrine', weight: 0.1 }
  ]
});

G({
  symbol: 'ARC', name: 'Activity-regulated cytoskeleton protein', chromosome: 8, position: 143689644,
  category: 'nervous', subcategory: 'neuroplasticity',
  description: 'Immediate-early gene critical for memory consolidation — forms virus-like capsids to transfer RNA between neurons',
  baseExpression: 0.45,
  bodySystemLinks: ['hippocampus', 'pfc', 'neuroplasticity', 'memory'],
  snps: [],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.03 },
    { trigger: 'dopamine', threshold: 55, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'CREB1', name: 'cAMP response element-binding protein', chromosome: 2, position: 208394615,
  category: 'nervous', subcategory: 'neuroplasticity',
  description: 'Master transcription factor for long-term memory — converts short-term synaptic changes into lasting structural ones',
  baseExpression: 0.60,
  bodySystemLinks: ['hippocampus', 'pfc', 'memory', 'neuroplasticity'],
  snps: [],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 55, direction: 'up', magnitude: 0.015 },
    { trigger: 'norepinephrine', threshold: 50, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: 0.05 },
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'FKBP5', name: 'FK506-binding protein 5', chromosome: 6, position: 35541362,
  category: 'nervous', subcategory: 'stress',
  description: 'Glucocorticoid receptor co-chaperone — regulates cortisol sensitivity and is epigenetically modified by trauma',
  baseExpression: 0.50,
  bodySystemLinks: ['cortisol', 'hpa_axis', 'amygdala', 'stress'],
  snps: [{
    id: 'rs1360780', rs: 'rs1360780', alleles: ['C', 'T'], frequencies: [0.72, 0.28],
    effects: {
      'C/C': { cortisol_sensitivity: 0.05, ptsd_risk: -0.05, label: 'Normal GR sensitivity' },
      'C/T': { cortisol_sensitivity: 0, ptsd_risk: 0, label: 'Intermediate' },
      'T/T': { cortisol_sensitivity: -0.15, ptsd_risk: 0.15, label: 'Impaired cortisol feedback — PTSD risk with childhood adversity, epigenetic demethylation' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.03 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: -0.1 },
    { target: 'norepinephrine', weight: 0.1 }
  ]
});

G({
  symbol: 'NR3C1', name: 'Glucocorticoid receptor', chromosome: 5, position: 143277931,
  category: 'nervous', subcategory: 'stress',
  description: 'Nuclear receptor for cortisol — mediates the entire stress response shutdown via negative feedback to HPA axis',
  baseExpression: 0.65,
  bodySystemLinks: ['cortisol', 'hpa_axis', 'hippocampus', 'immune'],
  snps: [{
    id: 'BclI', rs: 'rs41423247', alleles: ['C', 'G'], frequencies: [0.62, 0.38],
    effects: {
      'C/C': { cortisol_feedback: 0.05, label: 'Normal cortisol negative feedback' },
      'C/G': { cortisol_feedback: 0, label: 'Intermediate' },
      'G/G': { cortisol_feedback: -0.1, label: 'Enhanced GR sensitivity — stronger cortisol response, metabolic syndrome risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.1 },
    { target: 'norepinephrine', weight: -0.15 }
  ]
});

G({
  symbol: 'CNR1', name: 'Cannabinoid receptor 1', chromosome: 6, position: 88143244,
  category: 'nervous', subcategory: 'endocannabinoid',
  description: 'Main brain cannabinoid receptor — mediates retrograde synaptic signaling, appetite, pain, and mood regulation',
  baseExpression: 0.55,
  bodySystemLinks: ['endocannabinoid', 'appetite', 'pain', 'mood'],
  snps: [{
    id: 'rs1049353', rs: 'rs1049353', alleles: ['C', 'T'], frequencies: [0.82, 0.18],
    effects: {
      'C/C': { cb1_density: 0.05, label: 'Normal CB1 expression' },
      'C/T': { cb1_density: 0, label: 'Intermediate' },
      'T/T': { cb1_density: -0.1, label: 'Reduced CB1 — altered endocannabinoid tone, depression risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.1 },
    { target: 'dopamine', weight: 0.05 }
  ]
});

G({
  symbol: 'FAAH', name: 'Fatty acid amide hydrolase', chromosome: 1, position: 46870724,
  category: 'nervous', subcategory: 'endocannabinoid',
  description: 'Degrades anandamide (endogenous cannabinoid) — low activity variant linked to reduced anxiety and better fear extinction',
  baseExpression: 0.60,
  bodySystemLinks: ['endocannabinoid', 'amygdala', 'anxiety'],
  snps: [{
    id: 'C385A', rs: 'rs324420', alleles: ['C', 'A'], frequencies: [0.62, 0.38],
    effects: {
      'C/C': { anandamide_clearance: 0.1, anxiety: 0.05, label: 'Normal FAAH activity — standard anandamide levels' },
      'C/A': { anandamide_clearance: 0, anxiety: 0, label: 'Intermediate' },
      'A/A': { anandamide_clearance: -0.15, anxiety: -0.1, label: 'Reduced FAAH — elevated anandamide, lower anxiety, better fear extinction' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'gaba', weight: 0.1 },
    { target: 'valence', weight: 0.1 }
  ]
});

G({
  symbol: 'SLC6A3', name: 'Dopamine transporter (DAT1)', chromosome: 5, position: 1392791,
  category: 'nervous', subcategory: 'dopamine',
  description: 'Reuptake transporter that clears dopamine from the synapse — primary target of cocaine, methylphenidate, and amphetamine',
  baseExpression: 0.60,
  bodySystemLinks: ['dopamine', 'striatum', 'reward'],
  snps: [{
    id: '10R-VNTR', rs: 'rs28363170', alleles: ['9R', '10R'], frequencies: [0.25, 0.75],
    effects: {
      '10R/10R': { dopamine_clearance: 0.1, adhd_risk: 0.05, label: 'Higher DAT expression — faster dopamine clearance, ADHD association' },
      '9R/10R': { dopamine_clearance: 0, adhd_risk: 0, label: 'Intermediate' },
      '9R/9R': { dopamine_clearance: -0.1, adhd_risk: -0.05, label: 'Lower DAT — prolonged dopamine signaling' }
    }
  }],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 65, direction: 'up', magnitude: 0.025 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: -0.3 }
  ]
});

G({
  symbol: 'GAD1', name: 'Glutamate decarboxylase 1 (GAD67)', chromosome: 2, position: 171680935,
  category: 'nervous', subcategory: 'inhibition',
  description: 'Synthesizes GABA from glutamate — the enzyme that makes the brain\'s primary inhibitory neurotransmitter',
  baseExpression: 0.65,
  bodySystemLinks: ['gaba', 'cortex', 'inhibition'],
  snps: [],
  expressionDrivers: [
    { trigger: 'gaba', threshold: 35, direction: 'up', magnitude: 0.025 },
    { trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.35 }
  ]
});

G({
  symbol: 'GAD2', name: 'Glutamate decarboxylase 2 (GAD65)', chromosome: 10, position: 26512299,
  category: 'nervous', subcategory: 'inhibition',
  description: 'Synaptic GABA synthesis enzyme — activated on demand during intense neural activity to replenish GABA pools',
  baseExpression: 0.60,
  bodySystemLinks: ['gaba', 'synapse'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 60, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'gaba', weight: 0.25 }
  ]
});

G({
  symbol: 'TH', name: 'Tyrosine hydroxylase', chromosome: 11, position: 2188013,
  category: 'nervous', subcategory: 'catecholamine',
  description: 'Rate-limiting enzyme for dopamine and norepinephrine synthesis — converts tyrosine to L-DOPA',
  baseExpression: 0.65,
  bodySystemLinks: ['dopamine', 'norepinephrine', 'substantia_nigra', 'locus_coeruleus'],
  snps: [{
    id: 'Val81Met', rs: 'rs6356', alleles: ['G', 'A'], frequencies: [0.80, 0.20],
    effects: {
      'G/G': { catecholamine_synthesis: 0.05, label: 'Normal TH activity' },
      'G/A': { catecholamine_synthesis: 0, label: 'Intermediate' },
      'A/A': { catecholamine_synthesis: -0.1, label: 'Reduced catecholamine synthesis capacity' }
    }
  }],
  expressionDrivers: [
    { trigger: 'dopamine', threshold: 30, direction: 'up', magnitude: 0.03 },
    { trigger: 'norepinephrine', threshold: 30, direction: 'up', magnitude: 0.025 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.3 },
    { target: 'norepinephrine', weight: 0.25 }
  ]
});

G({
  symbol: 'DBH', name: 'Dopamine beta-hydroxylase', chromosome: 9, position: 136504908,
  category: 'nervous', subcategory: 'catecholamine',
  description: 'Converts dopamine to norepinephrine inside vesicles — deficiency causes pure dopaminergic state with no norepinephrine',
  baseExpression: 0.60,
  bodySystemLinks: ['norepinephrine', 'dopamine', 'sympathetic'],
  snps: [{
    id: 'rs1611115', rs: 'rs1611115', alleles: ['C', 'T'], frequencies: [0.78, 0.22],
    effects: {
      'C/C': { dbh_activity: 0.1, label: 'High DBH — efficient dopamine-to-NE conversion' },
      'C/T': { dbh_activity: 0, label: 'Intermediate' },
      'T/T': { dbh_activity: -0.15, label: 'Low DBH — elevated dopamine, low norepinephrine, orthostatic hypotension risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 30, direction: 'up', magnitude: 0.025 }
  ],
  expressionOutputs: [
    { target: 'norepinephrine', weight: 0.3 },
    { target: 'dopamine', weight: -0.15 }
  ]
});

G({
  symbol: 'ACHE', name: 'Acetylcholinesterase', chromosome: 7, position: 100889994,
  category: 'nervous', subcategory: 'acetylcholine',
  description: 'Rapidly breaks down acetylcholine at the synapse — fastest enzyme in the body, target of nerve agents and Alzheimer drugs',
  baseExpression: 0.70,
  bodySystemLinks: ['acetylcholine', 'neuromuscular_junction', 'pfc'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: -0.1 }
  ]
});

G({
  symbol: 'CHAT', name: 'Choline acetyltransferase', chromosome: 10, position: 50817450,
  category: 'nervous', subcategory: 'acetylcholine',
  description: 'Synthesizes acetylcholine from choline and acetyl-CoA — critical for memory, attention, and motor control',
  baseExpression: 0.60,
  bodySystemLinks: ['acetylcholine', 'basal_forebrain', 'memory'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 40, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: 0.1 },
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'GRM5', name: 'Metabotropic glutamate receptor 5', chromosome: 11, position: 88443068,
  category: 'nervous', subcategory: 'glutamate',
  description: 'Modulates synaptic plasticity and excitability — therapeutic target for anxiety, depression, and fragile X syndrome',
  baseExpression: 0.55,
  bodySystemLinks: ['glutamate', 'hippocampus', 'striatum'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.05 },
    { target: 'arousal', weight: 0.1 }
  ]
});

G({
  symbol: 'CACNA1C', name: 'Voltage-gated calcium channel alpha-1C', chromosome: 12, position: 1970786,
  category: 'nervous', subcategory: 'ion_channel',
  description: 'L-type calcium channel crucial for neuronal excitability and gene expression — strongest GWAS hit for bipolar disorder',
  baseExpression: 0.60,
  bodySystemLinks: ['calcium', 'excitability', 'pfc', 'hippocampus'],
  snps: [{
    id: 'rs1006737', rs: 'rs1006737', alleles: ['G', 'A'], frequencies: [0.67, 0.33],
    effects: {
      'G/G': { calcium_current: 0, label: 'Standard L-type calcium channel function' },
      'G/A': { calcium_current: 0.05, label: 'Mildly increased calcium influx' },
      'A/A': { calcium_current: 0.15, bipolar_risk: 0.1, label: 'Increased calcium current — enhanced excitability, bipolar risk' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'arousal', weight: 0.1 },
    { target: 'dopamine', weight: 0.05 }
  ]
});

G({
  symbol: 'ANK3', name: 'Ankyrin 3', chromosome: 10, position: 61832774,
  category: 'nervous', subcategory: 'ion_channel',
  description: 'Anchors sodium channels at axon initial segments — critical for action potential initiation, bipolar disorder gene',
  baseExpression: 0.65,
  bodySystemLinks: ['sodium', 'axon', 'excitability'],
  snps: [{
    id: 'rs10994336', rs: 'rs10994336', alleles: ['C', 'T'], frequencies: [0.93, 0.07],
    effects: {
      'C/C': { excitability: 0, label: 'Normal sodium channel clustering' },
      'C/T': { excitability: 0.05, label: 'Mildly altered' },
      'T/T': { excitability: 0.15, label: 'Disrupted channel anchoring — bipolar risk' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'arousal', weight: 0.05 }
  ]
});

G({
  symbol: 'SYN1', name: 'Synapsin 1', chromosome: 'X', position: 47576407,
  category: 'nervous', subcategory: 'synaptic',
  description: 'Tethers synaptic vesicles to the cytoskeleton — mutations cause epilepsy and learning disability',
  baseExpression: 0.65,
  bodySystemLinks: ['synapse', 'vesicle_release'],
  snps: [],
  expressionDrivers: [
    { trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.03 },
    { target: 'gaba', weight: 0.03 }
  ]
});

G({
  symbol: 'SNAP25', name: 'Synaptosome-associated protein 25', chromosome: 20, position: 10198975,
  category: 'nervous', subcategory: 'synaptic',
  description: 'SNARE complex component for vesicle fusion — polymorphisms associated with ADHD and cognitive performance',
  baseExpression: 0.65,
  bodySystemLinks: ['synapse', 'vesicle_release', 'pfc'],
  snps: [{
    id: 'rs3746544', rs: 'rs3746544', alleles: ['T', 'G'], frequencies: [0.75, 0.25],
    effects: {
      'T/T': { vesicle_release: 0.05, label: 'Normal SNARE function' },
      'T/G': { vesicle_release: 0, label: 'Intermediate' },
      'G/G': { vesicle_release: -0.1, adhd_risk: 0.05, label: 'Reduced vesicle fusion efficiency — ADHD association' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'dopamine', weight: 0.05 },
    { target: 'norepinephrine', weight: 0.05 }
  ]
});

// Additional nervous system genes (compact form)
G({ symbol: 'SLC6A2', name: 'Norepinephrine transporter (NET)', chromosome: 16, position: 55690317, category: 'nervous', subcategory: 'norepinephrine', description: 'Clears norepinephrine from the synapse — target of atomoxetine (ADHD) and SNRIs', baseExpression: 0.60, bodySystemLinks: ['norepinephrine', 'locus_coeruleus'], snps: [{ id: 'rs5569', rs: 'rs5569', alleles: ['G', 'A'], frequencies: [0.65, 0.35], effects: { 'G/G': { ne_clearance: 0.05, label: 'Normal NET function' }, 'G/A': { ne_clearance: 0, label: 'Intermediate' }, 'A/A': { ne_clearance: -0.1, label: 'Reduced NET — prolonged NE signaling' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.02 }], expressionOutputs: [{ target: 'norepinephrine', weight: -0.25 }] });

G({ symbol: 'HTR1B', name: 'Serotonin receptor 1B', chromosome: 6, position: 78172762, category: 'nervous', subcategory: 'serotonin', description: 'Terminal autoreceptor that inhibits serotonin release — implicated in aggression and substance abuse', baseExpression: 0.55, bodySystemLinks: ['serotonin', 'striatum'], snps: [{ id: 'G861C', rs: 'rs6296', alleles: ['G', 'C'], frequencies: [0.74, 0.26], effects: { 'G/G': { serotonin_release: 0, label: 'Normal 5-HT1B function' }, 'G/C': { serotonin_release: 0.05, label: 'Slightly increased release' }, 'C/C': { serotonin_release: 0.1, label: 'Reduced autoinhibition — more serotonin release' } } }], expressionDrivers: [{ trigger: 'serotonin', threshold: 55, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'serotonin', weight: -0.1 }] });

G({ symbol: 'GRIN1', name: 'NMDA receptor subunit 1', chromosome: 9, position: 137139673, category: 'nervous', subcategory: 'glutamate', description: 'Obligatory NMDA receptor subunit — every NMDA receptor in the brain contains this protein', baseExpression: 0.70, bodySystemLinks: ['glutamate', 'neuroplasticity', 'hippocampus'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'DRD1', name: 'Dopamine receptor D1', chromosome: 5, position: 175440254, category: 'nervous', subcategory: 'dopamine', description: 'Primary excitatory dopamine receptor in PFC and striatum — critical for working memory and reward learning', baseExpression: 0.60, bodySystemLinks: ['dopamine', 'pfc', 'working_memory'], snps: [], expressionDrivers: [{ trigger: 'dopamine', threshold: 40, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'dopamine', weight: 0.1 }, { target: 'arousal', weight: 0.1 }] });

G({ symbol: 'DRD3', name: 'Dopamine receptor D3', chromosome: 3, position: 114127544, category: 'nervous', subcategory: 'dopamine', description: 'Limbic dopamine receptor involved in reward, emotion, and motivation — target of cariprazine for schizophrenia', baseExpression: 0.50, bodySystemLinks: ['dopamine', 'nucleus_accumbens'], snps: [{ id: 'Ser9Gly', rs: 'rs6280', alleles: ['A', 'G'], frequencies: [0.65, 0.35], effects: { 'A/A': { d3_affinity: 0.05, label: 'Higher D3 dopamine affinity' }, 'A/G': { d3_affinity: 0, label: 'Intermediate' }, 'G/G': { d3_affinity: -0.1, label: 'Lower D3 affinity — altered reward processing' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.05 }, { target: 'valence', weight: 0.05 }] });

G({ symbol: 'GABRA1', name: 'GABA-A receptor alpha-1 subunit', chromosome: 5, position: 161849588, category: 'nervous', subcategory: 'inhibition', description: 'Most abundant GABA-A subunit — mediates sedation and anticonvulsant effects of benzodiazepines', baseExpression: 0.65, bodySystemLinks: ['gaba', 'sedation', 'cortex'], snps: [], expressionDrivers: [{ trigger: 'gaba', threshold: 40, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'gaba', weight: 0.2 }, { target: 'arousal', weight: -0.1 }] });

G({ symbol: 'GABRG2', name: 'GABA-A receptor gamma-2 subunit', chromosome: 5, position: 161849588, category: 'nervous', subcategory: 'inhibition', description: 'Required for benzodiazepine binding site formation — mutations cause epilepsy and febrile seizures', baseExpression: 0.60, bodySystemLinks: ['gaba', 'benzodiazepine_site'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.15 }] });

G({ symbol: 'SLC17A7', name: 'Vesicular glutamate transporter 1 (VGLUT1)', chromosome: 19, position: 49467757, category: 'nervous', subcategory: 'glutamate', description: 'Loads glutamate into synaptic vesicles in cortex and hippocampus — determines excitatory transmission strength', baseExpression: 0.65, bodySystemLinks: ['glutamate', 'cortex', 'hippocampus'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }, { target: 'norepinephrine', weight: 0.03 }] });

// Ion channels — sodium, potassium, calcium
G({ symbol: 'SCN1A', name: 'Sodium voltage-gated channel alpha subunit 1', chromosome: 2, position: 166845670, category: 'nervous', subcategory: 'ion_channel', description: 'Major brain sodium channel — mutations cause Dravet syndrome (severe childhood epilepsy) and febrile seizures', baseExpression: 0.70, bodySystemLinks: ['sodium', 'action_potential', 'cortex', 'epilepsy'], snps: [{ id: 'rs2298771', rs: 'rs2298771', alleles: ['G', 'A'], frequencies: [0.75, 0.25], effects: { 'G/G': { channel_function: 0.05, label: 'Normal Nav1.1 function' }, 'G/A': { channel_function: 0, label: 'Intermediate' }, 'A/A': { channel_function: -0.05, epilepsy_risk: 0.05, label: 'Slightly altered — modest epilepsy risk increase' } } }], expressionDrivers: [{ trigger: 'arousal', threshold: 60, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'SCN2A', name: 'Sodium voltage-gated channel alpha subunit 2', chromosome: 2, position: 165990519, category: 'nervous', subcategory: 'ion_channel', description: 'Initiates action potentials at the axon initial segment — gain-of-function causes early-onset epilepsy, loss-of-function causes autism', baseExpression: 0.70, bodySystemLinks: ['sodium', 'action_potential', 'axon'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'SCN9A', name: 'Sodium voltage-gated channel alpha subunit 9', chromosome: 2, position: 167051697, category: 'nervous', subcategory: 'ion_channel', description: 'Pain-sensing sodium channel in dorsal root ganglia — loss-of-function causes complete insensitivity to pain, gain-of-function causes erythromelalgia', baseExpression: 0.60, bodySystemLinks: ['pain', 'sodium', 'peripheral_nerve'], snps: [{ id: 'rs6746030', rs: 'rs6746030', alleles: ['G', 'A'], frequencies: [0.85, 0.15], effects: { 'G/G': { pain_sensitivity: 0, label: 'Normal pain sensitivity' }, 'G/A': { pain_sensitivity: 0.05, label: 'Slightly increased pain perception' }, 'A/A': { pain_sensitivity: 0.15, label: 'Enhanced pain sensitivity' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'norepinephrine', weight: 0.03 }] });

G({ symbol: 'KCNA1', name: 'Potassium voltage-gated channel subfamily A member 1', chromosome: 12, position: 4916940, category: 'nervous', subcategory: 'ion_channel', description: 'Delayed rectifier K+ channel — mutations cause episodic ataxia type 1 with myokymia (visible muscle rippling)', baseExpression: 0.65, bodySystemLinks: ['potassium', 'repolarization', 'cerebellum'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.03 }] });

G({ symbol: 'KCNB1', name: 'Potassium voltage-gated channel subfamily B member 1', chromosome: 20, position: 48687994, category: 'nervous', subcategory: 'ion_channel', description: 'Kv2.1 delayed rectifier — major regulator of neuronal excitability, de novo mutations cause epileptic encephalopathy', baseExpression: 0.65, bodySystemLinks: ['potassium', 'excitability', 'cortex'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 60, direction: 'down', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: -0.05 }] });

G({ symbol: 'CACNA1A', name: 'Calcium voltage-gated channel subunit alpha1 A', chromosome: 19, position: 13206440, category: 'nervous', subcategory: 'ion_channel', description: 'P/Q-type calcium channel at nerve terminals — mutations cause familial hemiplegic migraine, episodic ataxia type 2, and spinocerebellar ataxia 6', baseExpression: 0.65, bodySystemLinks: ['calcium', 'neurotransmitter_release', 'cerebellum'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.03 }, { target: 'serotonin', weight: 0.03 }] });

G({ symbol: 'CACNA1B', name: 'Calcium voltage-gated channel subunit alpha1 B', chromosome: 9, position: 140772294, category: 'nervous', subcategory: 'ion_channel', description: 'N-type calcium channel in pain pathways — target of ziconotide (Prialt), derived from cone snail venom, for severe chronic pain', baseExpression: 0.60, bodySystemLinks: ['calcium', 'pain', 'spinal_cord'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'norepinephrine', weight: 0.03 }] });

// GABA receptor subtypes
G({ symbol: 'GABRA5', name: 'GABA-A receptor alpha-5 subunit', chromosome: 15, position: 27111864, category: 'nervous', subcategory: 'inhibition', description: 'Hippocampal GABA-A subunit involved in memory and learning — inverse agonists at this subunit enhance cognition', baseExpression: 0.55, bodySystemLinks: ['gaba', 'hippocampus', 'memory'], snps: [], expressionDrivers: [{ trigger: 'gaba', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'gaba', weight: 0.1 }] });

G({ symbol: 'GABRB3', name: 'GABA-A receptor beta-3 subunit', chromosome: 15, position: 26543552, category: 'nervous', subcategory: 'inhibition', description: 'Critical for tonic inhibition — deletion causes Angelman syndrome features, linked to autism and epilepsy', baseExpression: 0.60, bodySystemLinks: ['gaba', 'tonic_inhibition', 'development'], snps: [{ id: 'rs4906902', rs: 'rs4906902', alleles: ['G', 'A'], frequencies: [0.72, 0.28], effects: { 'G/G': { gaba_tone: 0.05, label: 'Normal tonic inhibition' }, 'G/A': { gaba_tone: 0, label: 'Intermediate' }, 'A/A': { gaba_tone: -0.05, label: 'Reduced tonic inhibition — anxiety susceptibility' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.15 }] });

G({ symbol: 'GABBR1', name: 'GABA-B receptor subunit 1', chromosome: 6, position: 29557852, category: 'nervous', subcategory: 'inhibition', description: 'Metabotropic GABA receptor — mediates slow inhibition and presynaptic inhibition, target of baclofen for spasticity', baseExpression: 0.60, bodySystemLinks: ['gaba', 'presynaptic_inhibition', 'spinal_cord'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.1 }, { target: 'arousal', weight: -0.05 }] });

// Additional neurotransmitter system genes
G({ symbol: 'DDC', name: 'DOPA decarboxylase', chromosome: 7, position: 50458443, category: 'nervous', subcategory: 'dopamine', description: 'Converts L-DOPA to dopamine and 5-HTP to serotonin — the shared final synthesis step for both catecholamines and serotonin', baseExpression: 0.65, bodySystemLinks: ['dopamine', 'serotonin', 'synthesis'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'dopamine', weight: 0.1 }, { target: 'serotonin', weight: 0.1 }] });

G({ symbol: 'PNKD', name: 'PNKD metallo-beta-lactamase domain containing', chromosome: 2, position: 218673517, category: 'nervous', subcategory: 'movement', description: 'Regulates neurotransmitter release at synapses — mutations cause paroxysmal nonkinesigenic dyskinesia (stress-triggered movement episodes)', baseExpression: 0.55, bodySystemLinks: ['movement', 'basal_ganglia', 'neurotransmitter_release'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC1A2', name: 'Excitatory amino acid transporter 2 (EAAT2/GLT-1)', chromosome: 11, position: 35251022, category: 'nervous', subcategory: 'glutamate', description: 'Clears 90% of synaptic glutamate — dysfunction causes excitotoxicity in ALS, epilepsy, and stroke', baseExpression: 0.70, bodySystemLinks: ['glutamate', 'astrocyte', 'neuroprotection'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: -0.05 }] });

G({ symbol: 'GRM1', name: 'Glutamate metabotropic receptor 1', chromosome: 6, position: 146348936, category: 'nervous', subcategory: 'glutamate', description: 'Group I metabotropic glutamate receptor in the cerebellum — essential for motor learning and cerebellar LTD', baseExpression: 0.55, bodySystemLinks: ['glutamate', 'cerebellum', 'motor_learning'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });

G({ symbol: 'NRXN3', name: 'Neurexin 3', chromosome: 14, position: 79745021, category: 'nervous', subcategory: 'synapse', description: 'Presynaptic adhesion molecule — organizes synaptic architecture, associated with autism, addiction, and schizophrenia', baseExpression: 0.60, bodySystemLinks: ['synapse', 'cell_adhesion', 'development'], snps: [{ id: 'rs8019381', rs: 'rs8019381', alleles: ['G', 'A'], frequencies: [0.78, 0.22], effects: { 'G/G': { synaptic_organization: 0.05, label: 'Normal neurexin-3 expression' }, 'G/A': { synaptic_organization: 0, label: 'Intermediate' }, 'A/A': { synaptic_organization: -0.05, label: 'Altered expression — addiction susceptibility' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.02 }] });

G({ symbol: 'NLGN4X', name: 'Neuroligin 4, X-linked', chromosome: 'X', position: 5808686, category: 'nervous', subcategory: 'synapse', description: 'Postsynaptic adhesion partner of neurexins — mutations cause X-linked autism spectrum disorder and intellectual disability', baseExpression: 0.55, bodySystemLinks: ['synapse', 'cell_adhesion', 'autism'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SHANK3', name: 'SH3 and multiple ankyrin repeat domains 3', chromosome: 22, position: 51113070, category: 'nervous', subcategory: 'synapse', description: 'Postsynaptic scaffold protein — deletion causes Phelan-McDermid syndrome (autism, intellectual disability, absent speech)', baseExpression: 0.60, bodySystemLinks: ['synapse', 'postsynaptic_density', 'autism'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.02 }] });

G({ symbol: 'DYRK1A', name: 'Dual specificity tyrosine phosphorylation regulated kinase 1A', chromosome: 21, position: 37705068, category: 'nervous', subcategory: 'neurodevelopment', description: 'Dosage-sensitive kinase on chromosome 21 — triplication contributes to intellectual disability in Down syndrome, haploinsufficiency causes microcephaly', baseExpression: 0.55, bodySystemLinks: ['neurodevelopment', 'cell_cycle', 'cognition'], snps: [{ id: 'rs2154545', rs: 'rs2154545', alleles: ['C', 'T'], frequencies: [0.70, 0.30], effects: { 'C/C': { kinase_activity: 0.05, label: 'Normal DYRK1A expression' }, 'C/T': { kinase_activity: 0, label: 'Intermediate' }, 'T/T': { kinase_activity: -0.05, label: 'Slightly reduced expression' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.02 }, { target: 'gaba', weight: 0.02 }] });

G({ symbol: 'APP', name: 'Amyloid precursor protein', chromosome: 21, position: 25880550, category: 'nervous', subcategory: 'neurodegeneration', description: 'Precursor to amyloid-beta peptide — triplication in Down syndrome causes early-onset Alzheimer disease, duplication alone is sufficient', baseExpression: 0.60, bodySystemLinks: ['alzheimer', 'amyloid', 'neurodegeneration', 'synapse'], snps: [{ id: 'rs63750847', rs: 'rs63750847', alleles: ['C', 'T'], frequencies: [0.999, 0.001], effects: { 'C/C': { amyloid_production: 0, label: 'Normal APP processing' }, 'C/T': { amyloid_production: -0.2, label: 'A673T — Icelandic protective variant, reduced amyloid' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'dopamine', weight: -0.02 }] });

G({ symbol: 'SOD1', name: 'Superoxide dismutase 1', chromosome: 21, position: 31659666, category: 'nervous', subcategory: 'neuroprotection', description: 'Cytoplasmic antioxidant enzyme on chromosome 21 — mutations cause 20% of familial ALS (Lou Gehrig disease)', baseExpression: 0.70, bodySystemLinks: ['antioxidant', 'motor_neuron', 'als', 'copper'], snps: [{ id: 'rs2234694', rs: 'rs2234694', alleles: ['C', 'A'], frequencies: [0.95, 0.05], effects: { 'C/C': { sod_activity: 0.05, label: 'Normal SOD1 activity' }, 'C/A': { sod_activity: 0, label: 'Intermediate' }, 'A/A': { sod_activity: -0.1, label: 'Reduced antioxidant capacity' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MAPT', name: 'Microtubule-associated protein tau', chromosome: 17, position: 45894382, category: 'nervous', subcategory: 'neurodegeneration', description: 'Stabilizes microtubules in axons — hyperphosphorylated tau forms neurofibrillary tangles in Alzheimer, frontotemporal dementia, and CTE', baseExpression: 0.60, bodySystemLinks: ['microtubule', 'axon', 'neurodegeneration', 'alzheimer'], snps: [{ id: 'H1/H2', rs: 'rs1052553', alleles: ['A', 'G'], frequencies: [0.78, 0.22], effects: { 'A/A': { tau_expression: 0.05, pd_risk: 0.05, label: 'H1/H1 — higher tau expression, increased PD/PSP risk' }, 'A/G': { tau_expression: 0, label: 'H1/H2 — intermediate' }, 'G/G': { tau_expression: -0.05, label: 'H2/H2 — lower tau, protective against tauopathies' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GBA2', name: 'Non-lysosomal glucosylceramidase', chromosome: 9, position: 35737680, category: 'nervous', subcategory: 'neurodegeneration', description: 'Metabolizes glucosylceramide at the cell surface — mutations cause hereditary spastic paraplegia and cerebellar ataxia', baseExpression: 0.55, bodySystemLinks: ['sphingolipid', 'cerebellum', 'motor_neuron'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  IMMUNE SYSTEM (~25 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({
  symbol: 'HLA-A', name: 'Major histocompatibility complex class I, A', chromosome: 6, position: 29942470,
  category: 'immune', subcategory: 'antigen_presentation',
  description: 'Presents intracellular peptides to CD8+ killer T cells — the most polymorphic gene in the human genome',
  baseExpression: 0.75,
  bodySystemLinks: ['immune', 'mhc', 'adaptive_immunity'],
  snps: [],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: []
});

G({
  symbol: 'HLA-B', name: 'Major histocompatibility complex class I, B', chromosome: 6, position: 31353872,
  category: 'immune', subcategory: 'antigen_presentation',
  description: 'Most polymorphic HLA class I gene with >6000 alleles — critical for immune recognition of infections and cancers',
  baseExpression: 0.75,
  bodySystemLinks: ['immune', 'mhc', 'adaptive_immunity'],
  snps: [],
  expressionDrivers: [],
  expressionOutputs: []
});

G({
  symbol: 'HLA-C', name: 'Major histocompatibility complex class I, C', chromosome: 6, position: 31268749,
  category: 'immune', subcategory: 'antigen_presentation',
  description: 'Primary ligand for KIR receptors on NK cells — bridges innate and adaptive immunity',
  baseExpression: 0.70,
  bodySystemLinks: ['immune', 'nk_cells', 'mhc'],
  snps: [],
  expressionDrivers: [],
  expressionOutputs: []
});

G({
  symbol: 'HLA-DRB1', name: 'Major histocompatibility complex class II, DRB1', chromosome: 6, position: 32578775,
  category: 'immune', subcategory: 'antigen_presentation',
  description: 'Presents extracellular peptides to CD4+ helper T cells — strongest genetic risk factor for rheumatoid arthritis and MS',
  baseExpression: 0.70,
  bodySystemLinks: ['immune', 'mhc', 'autoimmunity'],
  snps: [],
  expressionDrivers: [],
  expressionOutputs: []
});

G({
  symbol: 'IL6', name: 'Interleukin 6', chromosome: 7, position: 22725889,
  category: 'immune', subcategory: 'cytokine',
  description: 'Pro-inflammatory cytokine and acute-phase response driver — elevated in depression, obesity, and severe COVID-19',
  baseExpression: 0.40,
  bodySystemLinks: ['immune', 'inflammation', 'liver', 'brain'],
  snps: [{
    id: '-174G/C', rs: 'rs1800795', alleles: ['G', 'C'], frequencies: [0.58, 0.42],
    effects: {
      'G/G': { il6_production: 0.1, inflammation: 0.05, label: 'Higher IL-6 production — stronger acute phase response' },
      'G/C': { il6_production: 0, inflammation: 0, label: 'Intermediate' },
      'C/C': { il6_production: -0.1, inflammation: -0.05, label: 'Lower IL-6 — reduced inflammatory drive' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.025 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: -0.1 },
    { target: 'valence', weight: -0.05 }
  ]
});

G({
  symbol: 'IL10', name: 'Interleukin 10', chromosome: 1, position: 206767602,
  category: 'immune', subcategory: 'cytokine',
  description: 'Master anti-inflammatory cytokine — suppresses excessive immune responses and prevents autoimmune damage',
  baseExpression: 0.50,
  bodySystemLinks: ['immune', 'anti_inflammation', 'gut'],
  snps: [{
    id: '-1082A/G', rs: 'rs1800896', alleles: ['A', 'G'], frequencies: [0.50, 0.50],
    effects: {
      'G/G': { il10_production: 0.15, inflammation: -0.1, label: 'High IL-10 — strong anti-inflammatory capacity' },
      'A/G': { il10_production: 0.05, inflammation: -0.05, label: 'Intermediate' },
      'A/A': { il10_production: -0.1, inflammation: 0.05, label: 'Low IL-10 — weaker immune dampening' }
    }
  }],
  expressionDrivers: [
    { trigger: 'gaba', threshold: 55, direction: 'up', magnitude: 0.015 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: 0.05 },
    { target: 'valence', weight: 0.05 }
  ]
});

G({
  symbol: 'TNF', name: 'Tumor necrosis factor', chromosome: 6, position: 31575567,
  category: 'immune', subcategory: 'cytokine',
  description: 'Potent pro-inflammatory cytokine — drives fever, apoptosis, and septic shock; target of adalimumab and infliximab',
  baseExpression: 0.35,
  bodySystemLinks: ['immune', 'inflammation', 'apoptosis'],
  snps: [{
    id: '-308G/A', rs: 'rs1800629', alleles: ['G', 'A'], frequencies: [0.80, 0.20],
    effects: {
      'G/G': { tnf_production: 0, label: 'Standard TNF production' },
      'G/A': { tnf_production: 0.1, label: 'Elevated TNF — stronger inflammatory response' },
      'A/A': { tnf_production: 0.2, label: 'High TNF producer — autoimmune risk, strong pathogen defense' }
    }
  }],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.02 }
  ],
  expressionOutputs: [
    { target: 'serotonin', weight: -0.1 },
    { target: 'valence', weight: -0.05 }
  ]
});

G({ symbol: 'IFNG', name: 'Interferon gamma', chromosome: 12, position: 68154768, category: 'immune', subcategory: 'cytokine', description: 'Key Th1 cytokine that activates macrophages — essential for fighting intracellular pathogens like tuberculosis', baseExpression: 0.40, bodySystemLinks: ['immune', 'macrophage', 'th1'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.015 }], expressionOutputs: [] });

G({ symbol: 'TLR4', name: 'Toll-like receptor 4', chromosome: 9, position: 120466245, category: 'immune', subcategory: 'innate', description: 'Pattern recognition receptor for bacterial LPS — first line of defense that triggers innate immune activation', baseExpression: 0.55, bodySystemLinks: ['immune', 'innate_immunity', 'macrophage'], snps: [{ id: 'Asp299Gly', rs: 'rs4986790', alleles: ['A', 'G'], frequencies: [0.94, 0.06], effects: { 'A/A': { lps_response: 0.05, label: 'Normal TLR4 signaling' }, 'A/G': { lps_response: -0.05, label: 'Blunted LPS response — reduced sepsis risk but weaker defense' }, 'G/G': { lps_response: -0.15, label: 'Hyporesponsive — low inflammation but susceptible to gram-negative infections' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD4', name: 'CD4 molecule', chromosome: 12, position: 6789532, category: 'immune', subcategory: 'adaptive', description: 'Co-receptor on helper T cells and HIV entry receptor — defines the Th cell lineage that orchestrates adaptive immunity', baseExpression: 0.65, bodySystemLinks: ['immune', 't_cells', 'adaptive_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD8A', name: 'CD8 alpha chain', chromosome: 2, position: 87012858, category: 'immune', subcategory: 'adaptive', description: 'Co-receptor on cytotoxic T cells — marks the killer cells that destroy virus-infected and cancer cells', baseExpression: 0.60, bodySystemLinks: ['immune', 'cytotoxic_t_cells'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FOXP3', name: 'Forkhead box P3', chromosome: 'X', position: 49250697, category: 'immune', subcategory: 'regulatory', description: 'Master transcription factor for regulatory T cells — prevents autoimmunity by maintaining immune tolerance', baseExpression: 0.55, bodySystemLinks: ['immune', 'treg', 'tolerance'], snps: [], expressionDrivers: [{ trigger: 'gaba', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'valence', weight: 0.03 }] });

G({ symbol: 'RAG1', name: 'Recombination activating gene 1', chromosome: 11, position: 36532262, category: 'immune', subcategory: 'adaptive', description: 'V(D)J recombinase that generates antibody and T cell receptor diversity — without it, no adaptive immunity exists', baseExpression: 0.50, bodySystemLinks: ['immune', 'vdj_recombination', 'b_cells', 't_cells'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CTLA4', name: 'Cytotoxic T-lymphocyte associated protein 4', chromosome: 2, position: 203867788, category: 'immune', subcategory: 'checkpoint', description: 'Immune checkpoint that puts the brakes on T cell activation — target of ipilimumab cancer immunotherapy', baseExpression: 0.55, bodySystemLinks: ['immune', 'checkpoint', 't_cells'], snps: [{ id: '+49A/G', rs: 'rs231775', alleles: ['A', 'G'], frequencies: [0.60, 0.40], effects: { 'A/A': { immune_checkpoint: 0.1, autoimmune_risk: -0.05, label: 'Strong immune braking' }, 'A/G': { immune_checkpoint: 0, autoimmune_risk: 0, label: 'Intermediate' }, 'G/G': { immune_checkpoint: -0.1, autoimmune_risk: 0.1, label: 'Weaker checkpoint — autoimmune risk but stronger anti-tumor response' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'JAK2', name: 'Janus kinase 2', chromosome: 9, position: 4985245, category: 'immune', subcategory: 'signaling', description: 'Cytokine signal transducer for many immune pathways — gain-of-function V617F mutation drives polycythemia vera', baseExpression: 0.55, bodySystemLinks: ['immune', 'jak_stat', 'hematopoiesis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'STAT3', name: 'Signal transducer and activator of transcription 3', chromosome: 17, position: 42313324, category: 'immune', subcategory: 'signaling', description: 'Transcription factor for Th17 differentiation and acute phase response — constitutively active in many cancers', baseExpression: 0.55, bodySystemLinks: ['immune', 'jak_stat', 'inflammation'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'C3', name: 'Complement component 3', chromosome: 19, position: 6677704, category: 'immune', subcategory: 'complement', description: 'Central hub of the complement cascade — cleaved into C3a (inflammation) and C3b (opsonization) to destroy pathogens', baseExpression: 0.65, bodySystemLinks: ['immune', 'complement', 'innate_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NLRP3', name: 'NLR family pyrin domain containing 3', chromosome: 1, position: 247416203, category: 'immune', subcategory: 'inflammasome', description: 'Inflammasome sensor that triggers IL-1beta release — activated by diverse danger signals including uric acid and cholesterol crystals', baseExpression: 0.40, bodySystemLinks: ['immune', 'inflammasome', 'il1'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'valence', weight: -0.05 }] });

G({ symbol: 'IL1B', name: 'Interleukin 1 beta', chromosome: 2, position: 112829751, category: 'immune', subcategory: 'cytokine', description: 'Potent pro-inflammatory cytokine that induces fever and sickness behavior — mediates the brain-immune connection', baseExpression: 0.35, bodySystemLinks: ['immune', 'inflammation', 'fever', 'sickness_behavior'], snps: [{ id: '-511C/T', rs: 'rs16944', alleles: ['C', 'T'], frequencies: [0.65, 0.35], effects: { 'C/C': { il1b_production: 0, label: 'Normal IL-1b production' }, 'C/T': { il1b_production: 0.05, label: 'Slightly elevated' }, 'T/T': { il1b_production: 0.15, label: 'High IL-1b — stronger sickness response, gastric cancer risk' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.02 }], expressionOutputs: [{ target: 'serotonin', weight: -0.05 }, { target: 'valence', weight: -0.05 }] });

G({ symbol: 'IL2', name: 'Interleukin 2', chromosome: 4, position: 123372626, category: 'immune', subcategory: 'cytokine', description: 'T cell growth factor essential for clonal expansion — low doses promote Tregs (tolerance), high doses promote effectors (attack)', baseExpression: 0.35, bodySystemLinks: ['immune', 't_cell_proliferation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TGFB1', name: 'Transforming growth factor beta 1', chromosome: 19, position: 41836813, category: 'immune', subcategory: 'regulatory', description: 'Master immunosuppressive cytokine — promotes wound healing, fibrosis, and regulatory T cell differentiation', baseExpression: 0.55, bodySystemLinks: ['immune', 'wound_healing', 'fibrosis', 'treg'], snps: [], expressionDrivers: [{ trigger: 'gaba', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'valence', weight: 0.03 }] });

G({ symbol: 'CCR5', name: 'C-C chemokine receptor type 5', chromosome: 3, position: 46370854, category: 'immune', subcategory: 'chemokine', description: 'HIV co-receptor — delta32 deletion confers near-complete resistance to HIV-1 infection (the Berlin Patient cure)', baseExpression: 0.50, bodySystemLinks: ['immune', 'hiv', 'chemotaxis'], snps: [{ id: 'delta32', rs: 'rs333', alleles: ['wt', 'del32'], frequencies: [0.90, 0.10], effects: { 'wt/wt': { hiv_susceptibility: 0.05, label: 'Normal CCR5 — standard HIV susceptibility' }, 'wt/del32': { hiv_susceptibility: -0.1, label: 'Heterozygous — slower HIV progression' }, 'del32/del32': { hiv_susceptibility: -0.5, label: 'HIV resistant — functional cure demonstrated in transplant patients' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CXCR4', name: 'C-X-C chemokine receptor type 4', chromosome: 2, position: 136114349, category: 'immune', subcategory: 'chemokine', description: 'Major chemokine receptor for immune cell homing — also used by X4-tropic HIV strains for cell entry', baseExpression: 0.55, bodySystemLinks: ['immune', 'hematopoiesis', 'chemotaxis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'IRF7', name: 'Interferon regulatory factor 7', chromosome: 11, position: 612555, category: 'immune', subcategory: 'interferon', description: 'Master regulator of type I interferon response — critical first line defense against all viral infections', baseExpression: 0.45, bodySystemLinks: ['immune', 'interferon', 'antiviral'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'MYD88', name: 'Myeloid differentiation primary response 88', chromosome: 3, position: 38140479, category: 'immune', subcategory: 'innate', description: 'Central adaptor protein for most Toll-like receptors — the signal highway from pathogen detection to immune activation', baseExpression: 0.60, bodySystemLinks: ['immune', 'tlr_signaling', 'innate_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional immune genes — complement, adaptive, checkpoints
G({ symbol: 'C4A', name: 'Complement component 4A', chromosome: 6, position: 31982023, category: 'immune', subcategory: 'complement', description: 'Classical complement pathway component — copy number variation strongly linked to schizophrenia risk through excessive synaptic pruning', baseExpression: 0.60, bodySystemLinks: ['complement', 'innate_immunity', 'synaptic_pruning'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'C5', name: 'Complement component 5', chromosome: 9, position: 120952614, category: 'immune', subcategory: 'complement', description: 'Terminal complement component — cleavage product C5a is one of the most potent inflammatory mediators, target of eculizumab', baseExpression: 0.55, bodySystemLinks: ['complement', 'inflammation', 'membrane_attack'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD8B', name: 'CD8b molecule', chromosome: 2, position: 86793627, category: 'immune', subcategory: 'adaptive', description: 'Co-receptor on cytotoxic T cells — partners with CD8A to bind MHC class I, essential for killing virus-infected cells', baseExpression: 0.55, bodySystemLinks: ['t_cell', 'adaptive_immunity', 'cytotoxic'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD19', name: 'CD19 molecule', chromosome: 16, position: 28931940, category: 'immune', subcategory: 'adaptive', description: 'B cell surface marker and co-receptor — target of blinatumomab (BiTE antibody) and CAR-T cell therapy for leukemia', baseExpression: 0.55, bodySystemLinks: ['b_cell', 'adaptive_immunity', 'antibody'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PDCD1', name: 'Programmed cell death 1 (PD-1)', chromosome: 2, position: 241849881, category: 'immune', subcategory: 'checkpoint', description: 'Immune checkpoint receptor — blocking PD-1 with pembrolizumab/nivolumab unleashes T cells against cancer (Nobel Prize 2018)', baseExpression: 0.50, bodySystemLinks: ['immune_checkpoint', 't_cell', 'cancer_immunity'], snps: [{ id: 'rs2227981', rs: 'rs2227981', alleles: ['C', 'T'], frequencies: [0.60, 0.40], effects: { 'C/C': { immune_checkpoint: 0, label: 'Normal PD-1 expression' }, 'C/T': { immune_checkpoint: -0.05, label: 'Slightly altered checkpoint function' }, 'T/T': { immune_checkpoint: -0.1, label: 'Modified PD-1 — altered autoimmune/cancer susceptibility balance' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD274', name: 'CD274 molecule (PD-L1)', chromosome: 9, position: 5450503, category: 'immune', subcategory: 'checkpoint', description: 'Ligand for PD-1 — tumors upregulate PD-L1 to hide from immune attack, PD-L1 expression level guides immunotherapy decisions', baseExpression: 0.45, bodySystemLinks: ['immune_checkpoint', 'tumor_immune_evasion'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AIRE', name: 'Autoimmune regulator', chromosome: 21, position: 44527561, category: 'immune', subcategory: 'tolerance', description: 'Expressed in thymic medulla — forces expression of peripheral tissue antigens to delete self-reactive T cells, preventing autoimmunity', baseExpression: 0.50, bodySystemLinks: ['thymus', 'central_tolerance', 'autoimmunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NFKB1', name: 'Nuclear factor kappa B subunit 1', chromosome: 4, position: 102501359, category: 'immune', subcategory: 'transcription_factor', description: 'Master inflammatory transcription factor — activated by virtually all immune stimuli, controls hundreds of pro-inflammatory genes', baseExpression: 0.55, bodySystemLinks: ['inflammation', 'immune_activation', 'cytokines'], snps: [{ id: 'rs28362491', rs: 'rs28362491', alleles: ['ins', 'del'], frequencies: [0.65, 0.35], effects: { 'ins/ins': { nfkb_activity: 0.05, label: 'Normal NF-kB activity' }, 'ins/del': { nfkb_activity: 0, label: 'Intermediate' }, 'del/del': { nfkb_activity: -0.1, label: 'Reduced NF-kB — altered inflammatory response' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'IL17A', name: 'Interleukin 17A', chromosome: 6, position: 52186371, category: 'immune', subcategory: 'cytokine', description: 'Pro-inflammatory cytokine from Th17 cells — key driver of psoriasis and autoimmune diseases, target of secukinumab', baseExpression: 0.40, bodySystemLinks: ['inflammation', 'th17', 'autoimmunity', 'psoriasis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'IL23A', name: 'Interleukin 23 subunit alpha', chromosome: 12, position: 56335117, category: 'immune', subcategory: 'cytokine', description: 'Maintains Th17 cell populations — IL-23/IL-17 axis drives psoriasis, Crohn disease, and ankylosing spondylitis', baseExpression: 0.40, bodySystemLinks: ['th17', 'autoimmunity', 'gut_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'STING1', name: 'Stimulator of interferon genes', chromosome: 5, position: 139475370, category: 'immune', subcategory: 'innate', description: 'Cytosolic DNA sensor — detects viral and damaged self-DNA to trigger type I interferon response, emerging cancer immunotherapy target', baseExpression: 0.50, bodySystemLinks: ['innate_immunity', 'interferon', 'dna_sensing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TMPRSS2', name: 'Transmembrane serine protease 2', chromosome: 21, position: 41473301, category: 'immune', subcategory: 'viral_entry', description: 'Serine protease on chromosome 21 that primes SARS-CoV-2 spike protein for cell entry — also forms oncogenic fusions with ERG in prostate cancer', baseExpression: 0.55, bodySystemLinks: ['viral_entry', 'lung', 'prostate'], snps: [{ id: 'rs12329760', rs: 'rs12329760', alleles: ['C', 'T'], frequencies: [0.75, 0.25], effects: { 'C/C': { protease_activity: 0.05, label: 'Normal TMPRSS2 — standard viral susceptibility' }, 'C/T': { protease_activity: -0.05, label: 'Reduced protease activity — possible COVID protection' }, 'T/T': { protease_activity: -0.1, label: 'Lower TMPRSS2 activity — may reduce SARS-CoV-2 entry efficiency' } } }], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  CARDIOVASCULAR SYSTEM (~20 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({
  symbol: 'MYH7', name: 'Myosin heavy chain 7 (cardiac beta)', chromosome: 14, position: 23881947,
  category: 'cardiovascular', subcategory: 'cardiac_muscle',
  description: 'Main contractile protein of the heart — mutations cause hypertrophic cardiomyopathy, the leading cause of sudden cardiac death in athletes',
  baseExpression: 0.80,
  bodySystemLinks: ['heart', 'muscle_contraction'],
  snps: [],
  expressionDrivers: [
    { trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }
  ],
  expressionOutputs: []
});

G({
  symbol: 'SCN5A', name: 'Sodium channel, voltage-gated, type V alpha', chromosome: 3, position: 38589553,
  category: 'cardiovascular', subcategory: 'cardiac_electrophysiology',
  description: 'Cardiac sodium channel that initiates each heartbeat — mutations cause Brugada syndrome and Long QT type 3',
  baseExpression: 0.75,
  bodySystemLinks: ['heart', 'conduction_system', 'sodium'],
  snps: [{
    id: 'H558R', rs: 'rs1805124', alleles: ['A', 'G'], frequencies: [0.80, 0.20],
    effects: {
      'A/A': { channel_function: 0, label: 'Normal cardiac sodium channel' },
      'A/G': { channel_function: -0.05, label: 'Mildly altered — can modify other SCN5A mutations' },
      'G/G': { channel_function: -0.1, label: 'Reduced channel current — may protect against arrhythmia in some backgrounds' }
    }
  }],
  expressionDrivers: [],
  expressionOutputs: [
    { target: 'arousal', weight: 0.03 }
  ]
});

G({ symbol: 'KCNQ1', name: 'Potassium channel, voltage-gated, KQT-like 1', chromosome: 11, position: 2444990, category: 'cardiovascular', subcategory: 'cardiac_electrophysiology', description: 'Cardiac potassium channel for repolarization — mutations cause Long QT syndrome type 1 and Romano-Ward syndrome', baseExpression: 0.70, bodySystemLinks: ['heart', 'repolarization', 'potassium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ACE', name: 'Angiotensin-converting enzyme', chromosome: 17, position: 63477061, category: 'cardiovascular', subcategory: 'blood_pressure', description: 'Converts angiotensin I to II — master regulator of blood pressure, target of ACE inhibitors like lisinopril', baseExpression: 0.60, bodySystemLinks: ['blood_pressure', 'renin_angiotensin', 'kidney'], snps: [{ id: 'I/D', rs: 'rs4340', alleles: ['I', 'D'], frequencies: [0.47, 0.53], effects: { 'I/I': { ace_activity: -0.1, endurance: 0.1, label: 'Low ACE — endurance athlete advantage, lower blood pressure' }, 'I/D': { ace_activity: 0, endurance: 0, label: 'Intermediate' }, 'D/D': { ace_activity: 0.15, power: 0.1, label: 'High ACE — power/sprint advantage, higher blood pressure' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'AGT', name: 'Angiotensinogen', chromosome: 1, position: 230838270, category: 'cardiovascular', subcategory: 'blood_pressure', description: 'Precursor to angiotensin II — liver-produced protein that feeds the renin-angiotensin blood pressure system', baseExpression: 0.60, bodySystemLinks: ['blood_pressure', 'renin_angiotensin', 'liver'], snps: [{ id: 'M235T', rs: 'rs699', alleles: ['M', 'T'], frequencies: [0.58, 0.42], effects: { 'M/M': { agt_level: 0, label: 'Normal angiotensinogen levels' }, 'M/T': { agt_level: 0.05, label: 'Slightly elevated' }, 'T/T': { agt_level: 0.15, label: 'Higher angiotensinogen — hypertension risk, especially in pregnancy' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NOS3', name: 'Endothelial nitric oxide synthase', chromosome: 7, position: 150690077, category: 'cardiovascular', subcategory: 'vasodilation', description: 'Produces nitric oxide for blood vessel relaxation — Nobel Prize 1998, basis of Viagra mechanism', baseExpression: 0.60, bodySystemLinks: ['nitric_oxide', 'endothelium', 'vasodilation'], snps: [{ id: 'G894T', rs: 'rs1799983', alleles: ['G', 'T'], frequencies: [0.65, 0.35], effects: { 'G/G': { no_production: 0.05, label: 'Normal NO production — good vascular health' }, 'G/T': { no_production: 0, label: 'Intermediate' }, 'T/T': { no_production: -0.1, label: 'Reduced NO — endothelial dysfunction, hypertension risk' } } }], expressionDrivers: [{ trigger: 'gaba', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: -0.03 }] });

G({ symbol: 'LDLR', name: 'Low-density lipoprotein receptor', chromosome: 19, position: 11089362, category: 'cardiovascular', subcategory: 'lipid', description: 'Clears LDL cholesterol from blood — mutations cause familial hypercholesterolemia, the most common lethal monogenic disorder', baseExpression: 0.65, bodySystemLinks: ['cholesterol', 'liver', 'atherosclerosis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'APOB', name: 'Apolipoprotein B', chromosome: 2, position: 21001429, category: 'cardiovascular', subcategory: 'lipid', description: 'Structural protein of LDL particles — each LDL has exactly one APOB molecule, making it a precise atherogenic particle count', baseExpression: 0.60, bodySystemLinks: ['cholesterol', 'ldl', 'liver'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PCSK9', name: 'Proprotein convertase subtilisin/kexin 9', chromosome: 1, position: 55039548, category: 'cardiovascular', subcategory: 'lipid', description: 'Degrades LDL receptors — loss-of-function mutations dramatically reduce heart disease risk, target of evolocumab', baseExpression: 0.50, bodySystemLinks: ['cholesterol', 'ldlr', 'liver'], snps: [{ id: 'R46L', rs: 'rs11591147', alleles: ['G', 'T'], frequencies: [0.97, 0.03], effects: { 'G/G': { ldl_level: 0, label: 'Normal PCSK9 function' }, 'G/T': { ldl_level: -0.15, cvd_risk: -0.15, label: 'Loss-of-function — 15% lower LDL, 47% lower heart disease risk' }, 'T/T': { ldl_level: -0.3, cvd_risk: -0.3, label: 'Strong loss-of-function — dramatically lower LDL and CVD risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GJA1', name: 'Gap junction alpha-1 (Connexin 43)', chromosome: 6, position: 121756733, category: 'cardiovascular', subcategory: 'cardiac_electrophysiology', description: 'Forms gap junctions between cardiomyocytes — enables coordinated heartbeat through electrical coupling', baseExpression: 0.75, bodySystemLinks: ['heart', 'gap_junction', 'conduction'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'VEGFA', name: 'Vascular endothelial growth factor A', chromosome: 6, position: 43737946, category: 'cardiovascular', subcategory: 'angiogenesis', description: 'Master regulator of blood vessel growth — essential for wound healing, exercise adaptation, and tumor angiogenesis', baseExpression: 0.50, bodySystemLinks: ['angiogenesis', 'endothelium', 'wound_healing'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'F5', name: 'Coagulation factor V', chromosome: 1, position: 169511951, category: 'cardiovascular', subcategory: 'coagulation', description: 'Clotting factor — Leiden mutation is the most common inherited thrombophilia, causing activated protein C resistance', baseExpression: 0.60, bodySystemLinks: ['coagulation', 'thrombosis'], snps: [{ id: 'Leiden', rs: 'rs6025', alleles: ['G', 'A'], frequencies: [0.95, 0.05], effects: { 'G/G': { clotting_risk: 0, label: 'Normal Factor V — standard clotting' }, 'G/A': { clotting_risk: 0.1, label: 'Heterozygous Leiden — 5-10x increased clotting risk' }, 'A/A': { clotting_risk: 0.3, label: 'Homozygous Leiden — 50-100x clotting risk, significant thrombosis danger' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KCNH2', name: 'Potassium channel, voltage-gated, H2 (hERG)', chromosome: 7, position: 150644440, category: 'cardiovascular', subcategory: 'cardiac_electrophysiology', description: 'hERG potassium channel — Long QT type 2 gene, also the main off-target of drug-induced arrhythmia (why drugs get pulled from market)', baseExpression: 0.70, bodySystemLinks: ['heart', 'repolarization', 'drug_safety'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RYR2', name: 'Ryanodine receptor 2', chromosome: 1, position: 237042075, category: 'cardiovascular', subcategory: 'cardiac_muscle', description: 'Cardiac calcium release channel in the SR — mutations cause catecholaminergic polymorphic VT (exercise-induced sudden death)', baseExpression: 0.75, bodySystemLinks: ['heart', 'calcium', 'excitation_contraction'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'MYBPC3', name: 'Myosin-binding protein C, cardiac', chromosome: 11, position: 47331394, category: 'cardiovascular', subcategory: 'cardiac_muscle', description: 'Sarcomeric protein regulating contraction strength — most commonly mutated gene in hypertrophic cardiomyopathy', baseExpression: 0.75, bodySystemLinks: ['heart', 'sarcomere', 'contraction'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NPPA', name: 'Natriuretic peptide A (ANP)', chromosome: 1, position: 11845955, category: 'cardiovascular', subcategory: 'blood_pressure', description: 'Atrial natriuretic peptide — released when atria stretch, lowers blood pressure by promoting sodium/water excretion', baseExpression: 0.50, bodySystemLinks: ['blood_pressure', 'kidney', 'heart'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'gaba', weight: 0.03 }] });

G({ symbol: 'EDN1', name: 'Endothelin 1', chromosome: 6, position: 12290360, category: 'cardiovascular', subcategory: 'vasoconstriction', description: 'Most potent vasoconstrictor known — 10x more powerful than angiotensin II, implicated in pulmonary hypertension', baseExpression: 0.40, bodySystemLinks: ['blood_pressure', 'endothelium', 'vasoconstriction'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'ADRB1', name: 'Beta-1 adrenergic receptor', chromosome: 10, position: 114044382, category: 'cardiovascular', subcategory: 'adrenergic', description: 'Primary cardiac adrenergic receptor — increases heart rate and contractility during fight-or-flight, target of beta-blockers', baseExpression: 0.60, bodySystemLinks: ['heart', 'sympathetic', 'adrenaline'], snps: [{ id: 'Ser49Gly', rs: 'rs1801252', alleles: ['A', 'G'], frequencies: [0.85, 0.15], effects: { 'A/A': { hr_response: 0, label: 'Normal beta-1 function' }, 'A/G': { hr_response: 0.05, label: 'Slightly enhanced adrenergic response' }, 'G/G': { hr_response: 0.1, label: 'Enhanced sympathetic cardiac drive — heart failure protective in some contexts' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 50, direction: 'up', magnitude: 0.02 }], expressionOutputs: [{ target: 'arousal', weight: 0.1 }, { target: 'norepinephrine', weight: 0.05 }] });

G({ symbol: 'ADRB2', name: 'Beta-2 adrenergic receptor', chromosome: 5, position: 148826593, category: 'cardiovascular', subcategory: 'adrenergic', description: 'Bronchodilator and vasodilator receptor — target of albuterol (asthma), also mediates skeletal muscle tremor', baseExpression: 0.55, bodySystemLinks: ['bronchodilation', 'vasodilation', 'sympathetic'], snps: [{ id: 'Arg16Gly', rs: 'rs1042713', alleles: ['A', 'G'], frequencies: [0.61, 0.39], effects: { 'A/A': { bronchodilation: 0, label: 'Normal beta-2 function' }, 'A/G': { bronchodilation: -0.05, label: 'Mildly reduced' }, 'G/G': { bronchodilation: -0.1, nocturnal_asthma: 0.1, label: 'Enhanced downregulation — nocturnal asthma risk, reduced albuterol response' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'AGTR1', name: 'Angiotensin II receptor type 1', chromosome: 3, position: 148415571, category: 'cardiovascular', subcategory: 'blood_pressure', description: 'Mediates vasoconstriction and aldosterone release from angiotensin II — target of losartan and other ARBs', baseExpression: 0.55, bodySystemLinks: ['blood_pressure', 'renin_angiotensin', 'vasoconstriction'], snps: [{ id: 'A1166C', rs: 'rs5186', alleles: ['A', 'C'], frequencies: [0.70, 0.30], effects: { 'A/A': { bp_response: 0, label: 'Normal angiotensin II responsiveness' }, 'A/C': { bp_response: 0.05, label: 'Slightly enhanced' }, 'C/C': { bp_response: 0.15, label: 'Enhanced AGTR1 expression — higher hypertension risk' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });

// Blood and hematology genes
G({ symbol: 'HBB', name: 'Hemoglobin subunit beta', chromosome: 11, position: 5225464, category: 'cardiovascular', subcategory: 'hemoglobin', description: 'Beta-globin chain of adult hemoglobin — sickle cell mutation (E6V) is the most famous single nucleotide change in medicine', baseExpression: 0.80, bodySystemLinks: ['hemoglobin', 'red_blood_cell', 'oxygen_transport'], snps: [{ id: 'E6V (sickle)', rs: 'rs334', alleles: ['A', 'T'], frequencies: [0.94, 0.06], effects: { 'A/A': { hb_function: 0.1, label: 'Normal HbA — full oxygen carrying capacity' }, 'A/T': { hb_function: -0.05, malaria_resistance: 0.15, label: 'Sickle trait — malaria protection, mild under extreme stress' }, 'T/T': { hb_function: -0.4, malaria_resistance: 0.2, label: 'Sickle cell disease — vaso-occlusive crises, chronic hemolysis' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });

G({ symbol: 'HBA1', name: 'Hemoglobin subunit alpha 1', chromosome: 16, position: 176680, category: 'cardiovascular', subcategory: 'hemoglobin', description: 'Alpha-globin gene 1 — deletions cause alpha-thalassemia, the most common single-gene disorder worldwide (malaria belt)', baseExpression: 0.80, bodySystemLinks: ['hemoglobin', 'red_blood_cell', 'oxygen_transport'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HBA2', name: 'Hemoglobin subunit alpha 2', chromosome: 16, position: 172876, category: 'cardiovascular', subcategory: 'hemoglobin', description: 'Alpha-globin gene 2 — together with HBA1, normally 4 copies exist. Loss of 3-4 causes hydrops fetalis (fatal)', baseExpression: 0.80, bodySystemLinks: ['hemoglobin', 'red_blood_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'EPO', name: 'Erythropoietin', chromosome: 7, position: 100720468, category: 'cardiovascular', subcategory: 'hematopoiesis', description: 'Kidney hormone stimulating red blood cell production — recombinant EPO treats anemia but was infamously abused in cycling doping', baseExpression: 0.50, bodySystemLinks: ['erythropoiesis', 'kidney', 'oxygen_sensing'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'EPOR', name: 'Erythropoietin receptor', chromosome: 19, position: 11381288, category: 'cardiovascular', subcategory: 'hematopoiesis', description: 'EPO receptor on red cell precursors — gain-of-function mutations cause familial erythrocytosis (natural high hematocrit)', baseExpression: 0.55, bodySystemLinks: ['erythropoiesis', 'bone_marrow', 'red_blood_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SERPINC1', name: 'Antithrombin III', chromosome: 1, position: 173872067, category: 'cardiovascular', subcategory: 'coagulation', description: 'Major natural anticoagulant — inhibits thrombin and factor Xa, deficiency causes severe venous thromboembolism', baseExpression: 0.60, bodySystemLinks: ['coagulation', 'anticoagulation', 'liver'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PROC', name: 'Protein C (coagulation)', chromosome: 2, position: 127898094, category: 'cardiovascular', subcategory: 'coagulation', description: 'Natural anticoagulant that inactivates factors Va and VIIIa — homozygous deficiency causes fatal purpura fulminans in neonates', baseExpression: 0.55, bodySystemLinks: ['coagulation', 'anticoagulation', 'endothelium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PDGFB', name: 'Platelet-derived growth factor subunit B', chromosome: 22, position: 39223354, category: 'cardiovascular', subcategory: 'growth_factor', description: 'Attracts pericytes to blood vessels — essential for vessel maturation. Chromosomal rearrangements cause dermatofibrosarcoma protuberans', baseExpression: 0.50, bodySystemLinks: ['angiogenesis', 'pericyte', 'wound_healing'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  METABOLIC / DIGESTIVE (~25 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'INS', name: 'Insulin', chromosome: 11, position: 2159779, category: 'metabolic', subcategory: 'glucose', description: 'The glucose-lowering hormone — secreted by beta cells, enables glucose uptake into cells. Without it: type 1 diabetes', baseExpression: 0.65, bodySystemLinks: ['glucose', 'pancreas', 'metabolism'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: -0.05 }] });

G({ symbol: 'INSR', name: 'Insulin receptor', chromosome: 19, position: 7112255, category: 'metabolic', subcategory: 'glucose', description: 'Receptor tyrosine kinase that transduces insulin signaling — mutations cause extreme insulin resistance syndromes', baseExpression: 0.65, bodySystemLinks: ['glucose', 'insulin_signaling', 'muscle', 'fat'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GCK', name: 'Glucokinase', chromosome: 7, position: 44183870, category: 'metabolic', subcategory: 'glucose', description: 'Pancreatic glucose sensor — sets the blood sugar threshold for insulin release. Mutations cause MODY2 diabetes', baseExpression: 0.60, bodySystemLinks: ['glucose', 'pancreas', 'glucose_sensing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'LCT', name: 'Lactase', chromosome: 2, position: 135837040, category: 'metabolic', subcategory: 'digestion', description: 'Breaks down lactose — persistence allele arose independently in pastoral populations, a textbook example of recent human evolution', baseExpression: 0.55, bodySystemLinks: ['digestion', 'small_intestine', 'dairy'], snps: [{ id: '-13910C/T', rs: 'rs4988235', alleles: ['C', 'T'], frequencies: [0.50, 0.50], effects: { 'C/C': { lactase_persistence: -0.3, label: 'Lactose intolerant — lactase declines after weaning' }, 'C/T': { lactase_persistence: 0.1, label: 'Lactose tolerant — dominant persistence allele' }, 'T/T': { lactase_persistence: 0.3, label: 'Full lactase persistence — strong dairy digestion throughout life' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ADH1B', name: 'Alcohol dehydrogenase 1B', chromosome: 4, position: 99318162, category: 'metabolic', subcategory: 'alcohol', description: 'First step in alcohol metabolism — fast variant (His47) causes acetaldehyde buildup, flushing, and alcoholism protection', baseExpression: 0.55, bodySystemLinks: ['alcohol', 'liver', 'metabolism'], snps: [{ id: 'His47Arg', rs: 'rs1229984', alleles: ['G', 'A'], frequencies: [0.75, 0.25], effects: { 'G/G': { alcohol_metabolism: 0, label: 'Normal speed alcohol metabolism' }, 'G/A': { alcohol_metabolism: 0.15, flush: 0.1, label: 'Fast metabolism — flushing, reduced alcoholism risk' }, 'A/A': { alcohol_metabolism: 0.3, flush: 0.25, label: 'Very fast — strong flush response, potent alcoholism protection' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ALDH2', name: 'Aldehyde dehydrogenase 2', chromosome: 12, position: 111766887, category: 'metabolic', subcategory: 'alcohol', description: 'Clears toxic acetaldehyde from alcohol — E504K mutation (40% of East Asians) causes Asian flush and cancer risk from drinking', baseExpression: 0.60, bodySystemLinks: ['alcohol', 'liver', 'acetaldehyde'], snps: [{ id: 'E504K', rs: 'rs671', alleles: ['G', 'A'], frequencies: [0.75, 0.25], effects: { 'G/G': { aldehyde_clearance: 0.1, label: 'Normal ALDH2 — efficient acetaldehyde clearance' }, 'G/A': { aldehyde_clearance: -0.15, flush: 0.15, label: 'Partial deficiency — flushing, higher esophageal cancer risk from alcohol' }, 'A/A': { aldehyde_clearance: -0.4, flush: 0.4, label: 'Near-complete deficiency — severe flushing, alcohol intolerance' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYP2D6', name: 'Cytochrome P450 2D6', chromosome: 22, position: 42522500, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Metabolizes 25% of all drugs including codeine, tamoxifen, antidepressants — has ultrarapid to poor metabolizer phenotypes', baseExpression: 0.55, bodySystemLinks: ['drug_metabolism', 'liver', 'pharmacogenomics'], snps: [{ id: '*4', rs: 'rs3892097', alleles: ['C', 'T'], frequencies: [0.78, 0.22], effects: { 'C/C': { cyp2d6_activity: 0.1, label: 'Normal/extensive metabolizer' }, 'C/T': { cyp2d6_activity: -0.1, label: 'Intermediate metabolizer' }, 'T/T': { cyp2d6_activity: -0.4, label: 'Poor metabolizer — codeine ineffective, SSRI toxicity risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYP3A4', name: 'Cytochrome P450 3A4', chromosome: 7, position: 99756960, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Metabolizes over 50% of all drugs — the most important drug-metabolizing enzyme in the human body', baseExpression: 0.65, bodySystemLinks: ['drug_metabolism', 'liver', 'gut'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MTHFR', name: 'Methylenetetrahydrofolate reductase', chromosome: 1, position: 11845955, category: 'metabolic', subcategory: 'folate', description: 'Key enzyme in folate metabolism and methylation — C677T variant reduces activity, affects homocysteine levels', baseExpression: 0.60, bodySystemLinks: ['folate', 'methylation', 'homocysteine'], snps: [{ id: 'C677T', rs: 'rs1801133', alleles: ['C', 'T'], frequencies: [0.65, 0.35], effects: { 'C/C': { mthfr_activity: 0.1, label: 'Full MTHFR activity' }, 'C/T': { mthfr_activity: -0.1, label: '65% activity — mild homocysteine elevation' }, 'T/T': { mthfr_activity: -0.3, label: '30% activity — significantly elevated homocysteine, supplemental folate needed' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.05 }] });

G({ symbol: 'FUT2', name: 'Fucosyltransferase 2', chromosome: 19, position: 49206417, category: 'metabolic', subcategory: 'digestion', description: 'Secretor gene — determines whether blood group antigens appear in saliva and gut mucus, affects microbiome composition', baseExpression: 0.55, bodySystemLinks: ['gut', 'microbiome', 'blood_group'], snps: [{ id: 'W154X', rs: 'rs601338', alleles: ['G', 'A'], frequencies: [0.55, 0.45], effects: { 'G/G': { secretor: 0.1, label: 'Secretor — blood antigens in saliva, richer gut microbiome' }, 'G/A': { secretor: 0.05, label: 'Secretor (dominant)' }, 'A/A': { secretor: -0.3, label: 'Non-secretor — resistant to norovirus, altered vitamin B12 absorption' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AMY1A', name: 'Amylase alpha 1A (salivary)', chromosome: 1, position: 104198140, category: 'metabolic', subcategory: 'digestion', description: 'Salivary starch-digesting enzyme — copy number varies 2-15x between individuals, higher in agricultural populations', baseExpression: 0.65, bodySystemLinks: ['digestion', 'saliva', 'starch'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HFE', name: 'Homeostatic iron regulator', chromosome: 6, position: 26087509, category: 'metabolic', subcategory: 'iron', description: 'Regulates iron absorption — C282Y mutation causes hereditary hemochromatosis (iron overload), most common genetic disease in Europeans', baseExpression: 0.60, bodySystemLinks: ['iron', 'liver', 'hepcidin'], snps: [{ id: 'C282Y', rs: 'rs1800562', alleles: ['G', 'A'], frequencies: [0.94, 0.06], effects: { 'G/G': { iron_absorption: 0, label: 'Normal iron regulation' }, 'G/A': { iron_absorption: 0.05, label: 'Carrier — slightly increased iron stores' }, 'A/A': { iron_absorption: 0.3, label: 'Hemochromatosis — progressive iron overload, organ damage without treatment' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PPARG', name: 'Peroxisome proliferator-activated receptor gamma', chromosome: 3, position: 12328915, category: 'metabolic', subcategory: 'lipid', description: 'Master regulator of fat cell differentiation — target of thiazolidinedione diabetes drugs (pioglitazone)', baseExpression: 0.55, bodySystemLinks: ['fat', 'insulin_sensitivity', 'adipocyte'], snps: [{ id: 'Pro12Ala', rs: 'rs1801282', alleles: ['C', 'G'], frequencies: [0.88, 0.12], effects: { 'C/C': { insulin_sensitivity: 0, label: 'Normal PPARG function' }, 'C/G': { insulin_sensitivity: 0.05, t2d_risk: -0.1, label: 'Ala variant — improved insulin sensitivity, lower type 2 diabetes risk' }, 'G/G': { insulin_sensitivity: 0.1, t2d_risk: -0.15, label: 'Strongly protective against type 2 diabetes' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'LEP', name: 'Leptin', chromosome: 7, position: 128241201, category: 'metabolic', subcategory: 'appetite', description: 'Satiety hormone from fat cells — signals energy reserves to hypothalamus. Deficiency causes insatiable hunger and severe obesity', baseExpression: 0.55, bodySystemLinks: ['appetite', 'hypothalamus', 'fat', 'satiety'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 40, direction: 'down', magnitude: 0.01 }], expressionOutputs: [{ target: 'valence', weight: 0.03 }] });

G({ symbol: 'LEPR', name: 'Leptin receptor', chromosome: 1, position: 65420652, category: 'metabolic', subcategory: 'appetite', description: 'Hypothalamic leptin receptor — mediates satiety signaling. Mutations phenocopy leptin deficiency with extreme obesity', baseExpression: 0.60, bodySystemLinks: ['appetite', 'hypothalamus', 'satiety'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MC4R', name: 'Melanocortin 4 receptor', chromosome: 18, position: 60371099, category: 'metabolic', subcategory: 'appetite', description: 'Central appetite suppression receptor — most common monogenic cause of obesity when mutated', baseExpression: 0.55, bodySystemLinks: ['appetite', 'hypothalamus', 'weight'], snps: [{ id: 'V103I', rs: 'rs2229616', alleles: ['G', 'A'], frequencies: [0.96, 0.04], effects: { 'G/G': { appetite_regulation: 0, label: 'Normal MC4R function' }, 'G/A': { appetite_regulation: 0.1, obesity_protection: 0.1, label: 'Gain-of-function — constitutively active, protective against obesity' }, 'A/A': { appetite_regulation: 0.2, obesity_protection: 0.2, label: 'Strong gain-of-function — significant obesity protection' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'UGT1A1', name: 'UDP-glucuronosyltransferase 1A1', chromosome: 2, position: 233759924, category: 'metabolic', subcategory: 'bilirubin', description: 'Conjugates bilirubin for excretion — reduced activity causes Gilbert syndrome (benign jaundice affecting 5-10% of people)', baseExpression: 0.60, bodySystemLinks: ['bilirubin', 'liver', 'conjugation'], snps: [{ id: 'UGT1A1*28', rs: 'rs8175347', alleles: ['6TA', '7TA'], frequencies: [0.65, 0.35], effects: { '6TA/6TA': { bilirubin_clearance: 0.1, label: 'Normal bilirubin conjugation' }, '6TA/7TA': { bilirubin_clearance: -0.05, label: 'Mildly reduced — possible fasting jaundice' }, '7TA/7TA': { bilirubin_clearance: -0.2, label: 'Gilbert syndrome — benign unconjugated hyperbilirubinemia, actually antioxidant' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC2A4', name: 'Glucose transporter type 4 (GLUT4)', chromosome: 17, position: 7281729, category: 'metabolic', subcategory: 'glucose', description: 'Insulin-responsive glucose transporter in muscle and fat — the molecular effector of insulin-mediated glucose uptake', baseExpression: 0.60, bodySystemLinks: ['glucose', 'insulin_signaling', 'muscle'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'HMGCR', name: 'HMG-CoA reductase', chromosome: 5, position: 74632993, category: 'metabolic', subcategory: 'cholesterol', description: 'Rate-limiting enzyme of cholesterol synthesis — the direct target of statin drugs, the most prescribed drug class in the world', baseExpression: 0.60, bodySystemLinks: ['cholesterol', 'liver', 'mevalonate'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GBA', name: 'Glucocerebrosidase', chromosome: 1, position: 155234452, category: 'metabolic', subcategory: 'lysosomal', description: 'Lysosomal enzyme — mutations cause Gaucher disease and are the strongest genetic risk factor for Parkinson disease', baseExpression: 0.60, bodySystemLinks: ['lysosome', 'sphingolipid', 'neurodegeneration'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HEXA', name: 'Hexosaminidase A', chromosome: 15, position: 72346580, category: 'metabolic', subcategory: 'lysosomal', description: 'Degrades GM2 ganglioside — deficiency causes Tay-Sachs disease (fatal neurodegeneration in infants)', baseExpression: 0.60, bodySystemLinks: ['lysosome', 'ganglioside', 'neurodegeneration'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'G6PD', name: 'Glucose-6-phosphate dehydrogenase', chromosome: 'X', position: 154531391, category: 'metabolic', subcategory: 'redox', description: 'Protects red blood cells from oxidative damage — most common enzyme deficiency in humans (400M affected), malaria protective', baseExpression: 0.60, bodySystemLinks: ['redox', 'red_blood_cells', 'malaria_resistance'], snps: [{ id: 'A-', rs: 'rs1050828', alleles: ['C', 'T'], frequencies: [0.88, 0.12], effects: { 'C/C': { g6pd_activity: 0.1, label: 'Normal G6PD — full antioxidant capacity in RBCs' }, 'C/T': { g6pd_activity: -0.1, label: 'Carrier female (X-linked) or affected male — hemolysis risk with oxidant drugs' }, 'T/T': { g6pd_activity: -0.3, label: 'Severe deficiency — favism, drug-induced hemolysis, malaria protection' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PKD1', name: 'Polycystin 1', chromosome: 16, position: 2138711, category: 'metabolic', subcategory: 'renal', description: 'Mechanosensor protein in kidney tubule cilia — mutations cause autosomal dominant polycystic kidney disease (1 in 1000)', baseExpression: 0.60, bodySystemLinks: ['kidney', 'cilia', 'fluid_sensing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CFTR', name: 'Cystic fibrosis transmembrane conductance regulator', chromosome: 7, position: 117559590, category: 'metabolic', subcategory: 'chloride_transport', description: 'Chloride/bicarbonate channel — deltaF508 mutation causes cystic fibrosis, the most common lethal genetic disease in Europeans', baseExpression: 0.60, bodySystemLinks: ['chloride', 'lung', 'pancreas', 'sweat'], snps: [{ id: 'deltaF508', rs: 'rs113993960', alleles: ['wt', 'del'], frequencies: [0.98, 0.02], effects: { 'wt/wt': { cftr_function: 0.1, label: 'Normal CFTR — proper chloride channel function' }, 'wt/del': { cftr_function: 0, label: 'Carrier — no symptoms, possible cholera resistance' }, 'del/del': { cftr_function: -0.5, label: 'Cystic fibrosis — thick mucus, lung infections, pancreatic insufficiency' } } }], expressionDrivers: [], expressionOutputs: [] });

// Cytochrome P450 expansion — drug metabolism
G({ symbol: 'CYP1A2', name: 'Cytochrome P450 1A2', chromosome: 15, position: 74748838, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Metabolizes caffeine, theophylline, and clozapine — determines how fast you clear your morning coffee', baseExpression: 0.60, bodySystemLinks: ['liver', 'drug_metabolism', 'caffeine'], snps: [{ id: 'rs762551', rs: 'rs762551', alleles: ['A', 'C'], frequencies: [0.68, 0.32], effects: { 'A/A': { caffeine_clearance: 0.15, label: 'Fast caffeine metabolizer — coffee is fine' }, 'A/C': { caffeine_clearance: 0, label: 'Intermediate' }, 'C/C': { caffeine_clearance: -0.15, label: 'Slow metabolizer — caffeine lingers, increased heart attack risk with heavy coffee' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: -0.03 }] });

G({ symbol: 'CYP2C19', name: 'Cytochrome P450 2C19', chromosome: 10, position: 94762681, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Metabolizes clopidogrel (Plavix), PPIs, and antidepressants — poor metabolizers get no benefit from clopidogrel after stent placement', baseExpression: 0.55, bodySystemLinks: ['liver', 'drug_metabolism', 'platelet'], snps: [{ id: 'rs4244285', rs: 'rs4244285', alleles: ['G', 'A'], frequencies: [0.85, 0.15], effects: { 'G/G': { cyp2c19_activity: 0.1, label: 'Normal metabolizer' }, 'G/A': { cyp2c19_activity: -0.1, label: 'Intermediate metabolizer — reduced drug activation' }, 'A/A': { cyp2c19_activity: -0.3, label: 'Poor metabolizer — clopidogrel failure, altered antidepressant response' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYP2C9', name: 'Cytochrome P450 2C9', chromosome: 10, position: 94938683, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Metabolizes warfarin, NSAIDs, and losartan — key pharmacogenomic gene for warfarin dosing', baseExpression: 0.60, bodySystemLinks: ['liver', 'drug_metabolism', 'warfarin'], snps: [{ id: 'CYP2C9*2', rs: 'rs1799853', alleles: ['C', 'T'], frequencies: [0.88, 0.12], effects: { 'C/C': { cyp2c9_activity: 0.05, label: 'Normal metabolizer — standard warfarin dose' }, 'C/T': { cyp2c9_activity: -0.1, label: 'Intermediate — lower warfarin dose needed' }, 'T/T': { cyp2c9_activity: -0.3, label: 'Poor metabolizer — significantly reduced warfarin dose, bleeding risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYP1B1', name: 'Cytochrome P450 1B1', chromosome: 2, position: 38067659, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Extrahepatic P450 in eye and steroid tissues — mutations cause primary congenital glaucoma, also activates environmental procarcinogens', baseExpression: 0.50, bodySystemLinks: ['eye', 'steroid_metabolism', 'carcinogen_activation'], snps: [{ id: 'rs1056836', rs: 'rs1056836', alleles: ['C', 'G'], frequencies: [0.58, 0.42], effects: { 'C/C': { enzyme_activity: 0, label: 'Normal CYP1B1 activity' }, 'C/G': { enzyme_activity: 0.05, label: 'Intermediate' }, 'G/G': { enzyme_activity: 0.1, label: 'Higher activity — increased estrogen metabolite production' } } }], expressionDrivers: [], expressionOutputs: [] });

// Alcohol and aldehyde dehydrogenases
G({ symbol: 'ADH1C', name: 'Alcohol dehydrogenase 1C (class I)', chromosome: 4, position: 99318213, category: 'metabolic', subcategory: 'alcohol', description: 'Class I alcohol dehydrogenase gamma subunit — polymorphisms affect rate of alcohol to acetaldehyde conversion', baseExpression: 0.55, bodySystemLinks: ['liver', 'alcohol_metabolism'], snps: [{ id: 'Ile350Val', rs: 'rs698', alleles: ['A', 'G'], frequencies: [0.60, 0.40], effects: { 'A/A': { adh_activity: 0.1, label: 'Fast alcohol oxidation — quicker initial metabolism' }, 'A/G': { adh_activity: 0, label: 'Intermediate' }, 'G/G': { adh_activity: -0.1, label: 'Slower alcohol oxidation' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ALDH1A1', name: 'Aldehyde dehydrogenase 1 family member A1', chromosome: 9, position: 72900627, category: 'metabolic', subcategory: 'aldehyde', description: 'Cytosolic aldehyde dehydrogenase — converts retinal to retinoic acid (vitamin A metabolism), also a stem cell marker', baseExpression: 0.55, bodySystemLinks: ['liver', 'retinoid', 'stem_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ALDH3A1', name: 'Aldehyde dehydrogenase 3 family member A1', chromosome: 17, position: 19774773, category: 'metabolic', subcategory: 'aldehyde', description: 'Corneal crystallin and aldehyde detoxifier — protects the eye from UV-generated aldehydes and maintains corneal transparency', baseExpression: 0.50, bodySystemLinks: ['cornea', 'detoxification', 'uv_protection'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Digestive enzymes
G({ symbol: 'PGA3', name: 'Pepsinogen 3 (pepsinogen A)', chromosome: 11, position: 61062918, category: 'metabolic', subcategory: 'digestion', description: 'Gastric protease precursor — activated by stomach acid to pepsin, initiates protein digestion. Low levels indicate gastric atrophy', baseExpression: 0.60, bodySystemLinks: ['stomach', 'protein_digestion', 'gastric_acid'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PRSS1', name: 'Serine protease 1 (trypsinogen)', chromosome: 7, position: 142750697, category: 'metabolic', subcategory: 'digestion', description: 'Pancreatic trypsinogen — gain-of-function mutations cause hereditary pancreatitis by premature trypsin activation in the pancreas', baseExpression: 0.60, bodySystemLinks: ['pancreas', 'protein_digestion', 'duodenum'], snps: [{ id: 'R122H', rs: 'rs111033565', alleles: ['G', 'A'], frequencies: [0.999, 0.001], effects: { 'G/G': { trypsin_autoactivation: 0, label: 'Normal trypsinogen — safe pancreatic protease' }, 'G/A': { trypsin_autoactivation: 0.2, label: 'Hereditary pancreatitis — trypsin resists inactivation, attacks pancreas' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PNLIP', name: 'Pancreatic lipase', chromosome: 10, position: 114078022, category: 'metabolic', subcategory: 'digestion', description: 'Primary enzyme for dietary fat digestion — hydrolyzes triglycerides at the oil-water interface with colipase', baseExpression: 0.60, bodySystemLinks: ['pancreas', 'fat_digestion', 'duodenum'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AMY2A', name: 'Amylase alpha 2A (pancreatic)', chromosome: 1, position: 103558257, category: 'metabolic', subcategory: 'digestion', description: 'Pancreatic amylase for starch digestion — complementing salivary AMY1A, copy number variation correlates with dietary starch intake', baseExpression: 0.60, bodySystemLinks: ['pancreas', 'starch_digestion'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Transporters — SLC and ABC families
G({ symbol: 'SLC2A1', name: 'Glucose transporter type 1 (GLUT1)', chromosome: 1, position: 43391453, category: 'metabolic', subcategory: 'glucose_transport', description: 'Constitutive glucose transporter at the blood-brain barrier — deficiency causes GLUT1 deficiency syndrome (seizures, movement disorder)', baseExpression: 0.75, bodySystemLinks: ['glucose', 'blood_brain_barrier', 'brain_metabolism'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'arousal', weight: 0.02 }] });

G({ symbol: 'SLC2A2', name: 'Glucose transporter type 2 (GLUT2)', chromosome: 3, position: 170715220, category: 'metabolic', subcategory: 'glucose_transport', description: 'Glucose sensor in pancreas and liver — bidirectional transporter that allows beta cells to sense blood glucose for insulin release', baseExpression: 0.60, bodySystemLinks: ['glucose', 'pancreas', 'liver', 'glucose_sensing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC5A1', name: 'Sodium/glucose cotransporter 1 (SGLT1)', chromosome: 22, position: 32087843, category: 'metabolic', subcategory: 'glucose_transport', description: 'Active glucose absorber in small intestine — uses sodium gradient to pump glucose against concentration gradient', baseExpression: 0.65, bodySystemLinks: ['glucose', 'intestine', 'sodium_cotransport'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC5A2', name: 'Sodium/glucose cotransporter 2 (SGLT2)', chromosome: 16, position: 31494881, category: 'metabolic', subcategory: 'glucose_transport', description: 'Reabsorbs 90% of filtered glucose in kidney — target of empagliflozin/dapagliflozin, now first-line for heart failure and CKD', baseExpression: 0.65, bodySystemLinks: ['glucose', 'kidney', 'reabsorption'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC7A5', name: 'Large neutral amino acid transporter (LAT1)', chromosome: 16, position: 87827058, category: 'metabolic', subcategory: 'amino_acid_transport', description: 'Imports large neutral amino acids including leucine, tryptophan, phenylalanine across the blood-brain barrier — essential for neurotransmitter precursor delivery', baseExpression: 0.65, bodySystemLinks: ['amino_acid', 'blood_brain_barrier', 'tryptophan'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.02 }] });

G({ symbol: 'SLC6A19', name: 'Neutral amino acid transporter B(0)AT1', chromosome: 5, position: 1203339, category: 'metabolic', subcategory: 'amino_acid_transport', description: 'Absorbs neutral amino acids in kidney and intestine — mutations cause Hartnup disease (tryptophan deficiency, pellagra-like rash)', baseExpression: 0.60, bodySystemLinks: ['amino_acid', 'kidney', 'intestine', 'tryptophan'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABCB1', name: 'ATP-binding cassette subfamily B member 1 (P-glycoprotein)', chromosome: 7, position: 87503017, category: 'metabolic', subcategory: 'efflux_transport', description: 'Drug efflux pump at blood-brain barrier and gut — pumps out hundreds of drugs, a major cause of multidrug resistance in cancer', baseExpression: 0.60, bodySystemLinks: ['blood_brain_barrier', 'drug_efflux', 'multidrug_resistance'], snps: [{ id: 'C3435T', rs: 'rs1045642', alleles: ['C', 'T'], frequencies: [0.55, 0.45], effects: { 'C/C': { efflux_activity: 0.1, label: 'High P-gp expression — more drug efflux, lower brain drug levels' }, 'C/T': { efflux_activity: 0, label: 'Intermediate' }, 'T/T': { efflux_activity: -0.1, label: 'Lower P-gp — more drug enters brain, higher sensitivity' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABCG2', name: 'ATP-binding cassette subfamily G member 2 (BCRP)', chromosome: 4, position: 88090264, category: 'metabolic', subcategory: 'efflux_transport', description: 'Breast cancer resistance protein — efflux transporter that limits oral bioavailability of drugs and excretes urate, gout association', baseExpression: 0.55, bodySystemLinks: ['drug_efflux', 'urate', 'placenta'], snps: [{ id: 'Q141K', rs: 'rs2231142', alleles: ['C', 'A'], frequencies: [0.72, 0.28], effects: { 'C/C': { urate_clearance: 0.05, label: 'Normal BCRP — good urate excretion' }, 'C/A': { urate_clearance: -0.05, label: 'Intermediate — mild gout risk increase' }, 'A/A': { urate_clearance: -0.15, label: 'Reduced BCRP — hyperuricemia and gout risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC12A3', name: 'Sodium-chloride cotransporter (NCC)', chromosome: 16, position: 56872282, category: 'metabolic', subcategory: 'electrolyte', description: 'Thiazide-sensitive NaCl transporter in distal kidney tubule — loss-of-function causes Gitelman syndrome (low potassium/magnesium)', baseExpression: 0.60, bodySystemLinks: ['kidney', 'sodium', 'potassium', 'magnesium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC22A1', name: 'Organic cation transporter 1 (OCT1)', chromosome: 6, position: 160122998, category: 'metabolic', subcategory: 'drug_transport', description: 'Hepatic uptake transporter for metformin and many other cationic drugs — polymorphisms determine metformin efficacy', baseExpression: 0.60, bodySystemLinks: ['liver', 'metformin', 'drug_transport'], snps: [{ id: 'rs12208357', rs: 'rs12208357', alleles: ['C', 'T'], frequencies: [0.92, 0.08], effects: { 'C/C': { oct1_activity: 0.05, label: 'Normal OCT1 — good metformin uptake into liver' }, 'C/T': { oct1_activity: -0.1, label: 'Reduced function — lower metformin efficacy' }, 'T/T': { oct1_activity: -0.2, label: 'Poor function — metformin may not work well' } } }], expressionDrivers: [], expressionOutputs: [] });

// CBS on chromosome 21
G({ symbol: 'CBS', name: 'Cystathionine beta-synthase', chromosome: 21, position: 43053190, category: 'metabolic', subcategory: 'amino_acid', description: 'Converts homocysteine to cystathionine in the transsulfuration pathway — deficiency causes homocystinuria (lens dislocation, thrombosis, intellectual disability)', baseExpression: 0.60, bodySystemLinks: ['homocysteine', 'methionine', 'liver', 'folate_cycle'], snps: [{ id: 'rs234706', rs: 'rs234706', alleles: ['C', 'T'], frequencies: [0.65, 0.35], effects: { 'C/C': { cbs_activity: 0.05, label: 'Normal CBS activity' }, 'C/T': { cbs_activity: 0, label: 'Intermediate' }, 'T/T': { cbs_activity: 0.1, label: 'Upregulated CBS — faster homocysteine clearance' } } }], expressionDrivers: [], expressionOutputs: [] });

// GART on chromosome 21
G({ symbol: 'GART', name: 'Phosphoribosylglycinamide formyltransferase/synthetase/formyltransferase', chromosome: 21, position: 33503814, category: 'metabolic', subcategory: 'purine_synthesis', description: 'Trifunctional enzyme in de novo purine biosynthesis on chromosome 21 — triplication contributes to altered nucleotide metabolism in Down syndrome', baseExpression: 0.55, bodySystemLinks: ['purine', 'nucleotide_synthesis', 'folate'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC40A1', name: 'Ferroportin (iron exporter)', chromosome: 2, position: 189560746, category: 'metabolic', subcategory: 'iron', description: 'Only known cellular iron exporter — mutations cause type 4 hemochromatosis (ferroportin disease), target of hepcidin regulation', baseExpression: 0.60, bodySystemLinks: ['iron', 'intestine', 'macrophage', 'liver'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HAMP', name: 'Hepcidin antimicrobial peptide', chromosome: 19, position: 35283565, category: 'metabolic', subcategory: 'iron', description: 'Master regulator of iron homeostasis — the iron hormone. Deficiency causes hemochromatosis, excess causes anemia of inflammation', baseExpression: 0.50, bodySystemLinks: ['iron', 'liver', 'iron_regulation'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  ENDOCRINE SYSTEM (~15 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'GH1', name: 'Growth hormone 1', chromosome: 17, position: 63917549, category: 'endocrine', subcategory: 'growth', description: 'Pituitary growth hormone — drives linear growth in childhood, maintains muscle and bone mass in adults', baseExpression: 0.55, bodySystemLinks: ['growth', 'pituitary', 'igf1_axis'], snps: [], expressionDrivers: [{ trigger: 'gaba', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });

G({ symbol: 'IGF1', name: 'Insulin-like growth factor 1', chromosome: 12, position: 102395874, category: 'endocrine', subcategory: 'growth', description: 'Mediator of growth hormone effects — promotes cell growth throughout the body, low levels linked to longevity paradoxically', baseExpression: 0.55, bodySystemLinks: ['growth', 'liver', 'muscle', 'bone'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TSHR', name: 'TSH receptor', chromosome: 14, position: 81082370, category: 'endocrine', subcategory: 'thyroid', description: 'Thyroid-stimulating hormone receptor — activating mutations cause hyperthyroidism, autoantibodies cause Graves disease', baseExpression: 0.60, bodySystemLinks: ['thyroid', 'metabolism', 'tsh'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'TG', name: 'Thyroglobulin', chromosome: 8, position: 133892783, category: 'endocrine', subcategory: 'thyroid', description: 'Precursor protein for thyroid hormones T3 and T4 — the iodine-containing scaffold from which thyroid hormones are cleaved', baseExpression: 0.60, bodySystemLinks: ['thyroid', 'iodine', 'metabolism'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYP19A1', name: 'Aromatase', chromosome: 15, position: 51208057, category: 'endocrine', subcategory: 'sex_hormones', description: 'Converts testosterone to estradiol — target of aromatase inhibitors in breast cancer, present in brain for neuroprotection', baseExpression: 0.50, bodySystemLinks: ['estrogen', 'testosterone', 'brain', 'fat'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'valence', weight: 0.03 }] });

G({ symbol: 'AR', name: 'Androgen receptor', chromosome: 'X', position: 67544021, category: 'endocrine', subcategory: 'sex_hormones', description: 'Nuclear receptor for testosterone and DHT — CAG repeat length inversely correlates with receptor sensitivity', baseExpression: 0.55, bodySystemLinks: ['testosterone', 'muscle', 'bone', 'brain'], snps: [{ id: 'CAG repeat', rs: 'rs193922933', alleles: ['short', 'long'], frequencies: [0.50, 0.50], effects: { 'short/short': { androgen_sensitivity: 0.15, label: 'High androgen sensitivity — stronger testosterone effects' }, 'short/long': { androgen_sensitivity: 0.05, label: 'Intermediate sensitivity' }, 'long/long': { androgen_sensitivity: -0.1, label: 'Reduced sensitivity — weaker androgen response, Kennedy disease at extremes' } } }], expressionDrivers: [{ trigger: 'arousal', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }, { target: 'dopamine', weight: 0.03 }] });

G({ symbol: 'ESR1', name: 'Estrogen receptor alpha', chromosome: 6, position: 151656691, category: 'endocrine', subcategory: 'sex_hormones', description: 'Primary estrogen receptor — mediates effects on bone density, cardiovascular protection, brain, and reproductive tissues', baseExpression: 0.55, bodySystemLinks: ['estrogen', 'bone', 'cardiovascular', 'brain'], snps: [{ id: 'PvuII', rs: 'rs2234693', alleles: ['T', 'C'], frequencies: [0.55, 0.45], effects: { 'T/T': { bone_density: 0, label: 'Standard ESR1 expression' }, 'T/C': { bone_density: 0.05, label: 'Slightly enhanced' }, 'C/C': { bone_density: 0.1, label: 'Higher ESR1 expression — better bone mineral density' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.05 }, { target: 'valence', weight: 0.03 }] });

G({ symbol: 'ESR2', name: 'Estrogen receptor beta', chromosome: 14, position: 64699747, category: 'endocrine', subcategory: 'sex_hormones', description: 'Second estrogen receptor — enriched in brain, prostate, and immune cells, modulates anxiety and depression', baseExpression: 0.50, bodySystemLinks: ['estrogen', 'brain', 'anxiety', 'immune'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.03 }, { target: 'serotonin', weight: 0.03 }] });

G({ symbol: 'CRH', name: 'Corticotropin-releasing hormone', chromosome: 8, position: 67088627, category: 'endocrine', subcategory: 'stress', description: 'Hypothalamic stress hormone that initiates the HPA axis cascade — the first domino in the cortisol stress response', baseExpression: 0.45, bodySystemLinks: ['hpa_axis', 'stress', 'hypothalamus', 'cortisol'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.03 }, { trigger: 'gaba', threshold: 60, direction: 'down', magnitude: 0.02 }], expressionOutputs: [{ target: 'norepinephrine', weight: 0.15 }, { target: 'gaba', weight: -0.1 }, { target: 'arousal', weight: 0.1 }] });

G({ symbol: 'POMC', name: 'Proopiomelanocortin', chromosome: 2, position: 25160854, category: 'endocrine', subcategory: 'multihormone', description: 'Precursor cleaved into ACTH, beta-endorphin, MSH — one gene producing stress, pain, appetite, and pigmentation hormones', baseExpression: 0.55, bodySystemLinks: ['acth', 'endorphin', 'msh', 'appetite', 'stress'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'valence', weight: 0.05 }, { target: 'arousal', weight: 0.05 }] });

G({ symbol: 'NR3C2', name: 'Mineralocorticoid receptor', chromosome: 4, position: 148078762, category: 'endocrine', subcategory: 'adrenal', description: 'High-affinity cortisol/aldosterone receptor — mediates salt-water balance and hippocampal stress response at low cortisol levels', baseExpression: 0.55, bodySystemLinks: ['aldosterone', 'cortisol', 'kidney', 'hippocampus'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.03 }] });

G({ symbol: 'SHBG', name: 'Sex hormone-binding globulin', chromosome: 17, position: 7630341, category: 'endocrine', subcategory: 'sex_hormones', description: 'Carrier protein that binds testosterone and estradiol — controls how much free (active) sex hormone is available to tissues', baseExpression: 0.55, bodySystemLinks: ['testosterone', 'estrogen', 'liver'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SRD5A2', name: '5-alpha reductase type 2', chromosome: 2, position: 31580540, category: 'endocrine', subcategory: 'sex_hormones', description: 'Converts testosterone to DHT (3x more potent) — target of finasteride for hair loss and prostate enlargement', baseExpression: 0.50, bodySystemLinks: ['dht', 'testosterone', 'prostate', 'hair'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GNRHR', name: 'Gonadotropin-releasing hormone receptor', chromosome: 4, position: 68598775, category: 'endocrine', subcategory: 'reproductive_axis', description: 'Pituitary receptor that triggers LH/FSH release — the master switch for puberty and the reproductive hormone cascade', baseExpression: 0.50, bodySystemLinks: ['gonadotropin', 'pituitary', 'puberty', 'reproductive'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KISS1', name: 'Kisspeptin', chromosome: 1, position: 204159589, category: 'endocrine', subcategory: 'puberty', description: 'Upstream trigger of GnRH neurons — discovery of its role was a breakthrough in understanding puberty initiation', baseExpression: 0.45, bodySystemLinks: ['puberty', 'gnrh', 'hypothalamus'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Growth factor expansion
G({ symbol: 'IGF2', name: 'Insulin-like growth factor 2', chromosome: 11, position: 2150342, category: 'endocrine', subcategory: 'growth', description: 'Paternally imprinted growth factor — major driver of fetal growth. Loss of imprinting causes Beckwith-Wiedemann syndrome (overgrowth)', baseExpression: 0.55, bodySystemLinks: ['fetal_growth', 'imprinting', 'placenta'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'EGF', name: 'Epidermal growth factor', chromosome: 4, position: 110834469, category: 'endocrine', subcategory: 'growth_factor', description: 'Promotes cell proliferation and differentiation — Nobel Prize 1986, led to discovery of EGFR and the targeted cancer therapy revolution', baseExpression: 0.50, bodySystemLinks: ['cell_growth', 'wound_healing', 'epithelium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FGF2', name: 'Fibroblast growth factor 2 (basic FGF)', chromosome: 4, position: 122826709, category: 'endocrine', subcategory: 'growth_factor', description: 'Potent angiogenic factor and wound healing promoter — signals through FGFRs to drive blood vessel growth, bone repair, and limb development', baseExpression: 0.50, bodySystemLinks: ['angiogenesis', 'wound_healing', 'bone', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PDGFA', name: 'Platelet-derived growth factor subunit A', chromosome: 7, position: 536155, category: 'endocrine', subcategory: 'growth_factor', description: 'Released from platelets during clotting — attracts fibroblasts and smooth muscle cells to wounds, drives connective tissue repair', baseExpression: 0.50, bodySystemLinks: ['wound_healing', 'fibroblast', 'smooth_muscle'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TGFB1', name: 'Transforming growth factor beta 1', chromosome: 19, position: 41301587, category: 'endocrine', subcategory: 'growth_factor', description: 'Pleiotropic cytokine controlling cell growth, differentiation, and immune regulation — promotes wound healing but excess causes fibrosis', baseExpression: 0.55, bodySystemLinks: ['fibrosis', 'immune_regulation', 'wound_healing', 'development'], snps: [{ id: 'rs1800469', rs: 'rs1800469', alleles: ['C', 'T'], frequencies: [0.70, 0.30], effects: { 'C/C': { tgfb_level: 0, label: 'Normal TGF-beta1 levels' }, 'C/T': { tgfb_level: 0.05, label: 'Slightly elevated' }, 'T/T': { tgfb_level: 0.15, label: 'Higher TGF-beta1 — increased fibrosis risk, stronger immune suppression' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BMP2', name: 'Bone morphogenetic protein 2', chromosome: 20, position: 6748311, category: 'endocrine', subcategory: 'growth_factor', description: 'Potent bone inducer — can convert any connective tissue into bone. Used clinically in spinal fusion surgery', baseExpression: 0.45, bodySystemLinks: ['bone', 'osteoblast', 'development', 'fracture_healing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BMP4', name: 'Bone morphogenetic protein 4', chromosome: 14, position: 53949736, category: 'endocrine', subcategory: 'growth_factor', description: 'Critical embryonic signaling molecule — patterns the dorsal-ventral axis, specifies tooth, eye, and limb development', baseExpression: 0.45, bodySystemLinks: ['development', 'bone', 'tooth', 'limb_patterning'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BMP7', name: 'Bone morphogenetic protein 7 (osteogenic protein 1)', chromosome: 20, position: 57399131, category: 'endocrine', subcategory: 'growth_factor', description: 'Required for kidney and eye development — anti-fibrotic in kidney, used in clinical trials for chronic kidney disease', baseExpression: 0.45, bodySystemLinks: ['kidney', 'eye', 'anti_fibrotic', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HIF1A', name: 'Hypoxia-inducible factor 1 alpha', chromosome: 14, position: 61695513, category: 'endocrine', subcategory: 'oxygen_sensing', description: 'Master oxygen sensor — stabilized in low oxygen to activate EPO, VEGF, and glycolytic genes. Nobel Prize 2019 for oxygen sensing discovery', baseExpression: 0.55, bodySystemLinks: ['oxygen_sensing', 'angiogenesis', 'erythropoiesis', 'metabolism'], snps: [{ id: 'P582S', rs: 'rs11549465', alleles: ['C', 'T'], frequencies: [0.92, 0.08], effects: { 'C/C': { hif_stability: 0, label: 'Normal HIF-1alpha regulation' }, 'C/T': { hif_stability: 0.1, label: 'More stable HIF — enhanced altitude adaptation in some populations' }, 'T/T': { hif_stability: 0.2, label: 'High HIF stability — strong hypoxic response' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });

G({ symbol: 'PRL', name: 'Prolactin', chromosome: 6, position: 22288090, category: 'endocrine', subcategory: 'lactation', description: 'Stimulates breast milk production and parental behavior — also modulates immune function and osmoregulation', baseExpression: 0.45, bodySystemLinks: ['lactation', 'breast', 'pituitary', 'parental_behavior'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'valence', weight: 0.03 }] });

G({ symbol: 'PTH', name: 'Parathyroid hormone', chromosome: 11, position: 13497048, category: 'endocrine', subcategory: 'calcium', description: 'Raises blood calcium by stimulating bone resorption, kidney reabsorption, and vitamin D activation — minute-to-minute calcium regulator', baseExpression: 0.55, bodySystemLinks: ['calcium', 'bone', 'kidney', 'vitamin_d'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CALCA', name: 'Calcitonin/calcitonin gene-related peptide', chromosome: 11, position: 14966615, category: 'endocrine', subcategory: 'calcium', description: 'Alternative splicing produces calcitonin (lowers calcium) or CGRP (potent vasodilator in migraines) — target of migraine antibody drugs', baseExpression: 0.50, bodySystemLinks: ['calcium', 'thyroid', 'migraine', 'vasodilation'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  STRUCTURAL — bones, connective tissue, muscle (~15 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'COL1A1', name: 'Collagen type I alpha 1', chromosome: 17, position: 50183289, category: 'structural', subcategory: 'connective_tissue', description: 'Most abundant protein in the human body — forms bones, skin, tendons, ligaments. Mutations cause osteogenesis imperfecta (brittle bone disease)', baseExpression: 0.75, bodySystemLinks: ['bone', 'skin', 'tendon', 'connective_tissue'], snps: [{ id: 'Sp1', rs: 'rs1800012', alleles: ['G', 'T'], frequencies: [0.82, 0.18], effects: { 'G/G': { bone_density: 0.05, label: 'Normal collagen production' }, 'G/T': { bone_density: -0.05, label: 'Mildly reduced bone density' }, 'T/T': { bone_density: -0.15, label: 'Lower bone density — increased osteoporosis and fracture risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'COL1A2', name: 'Collagen type I alpha 2', chromosome: 7, position: 94394658, category: 'structural', subcategory: 'connective_tissue', description: 'Partner chain of type I collagen — forms heterotrimers with COL1A1 at a 2:1 ratio', baseExpression: 0.75, bodySystemLinks: ['bone', 'skin', 'tendon'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'COL7A1', name: 'Collagen type VII alpha 1', chromosome: 3, position: 48586347, category: 'structural', subcategory: 'skin', description: 'Anchoring fibril collagen that attaches epidermis to dermis — mutations cause dystrophic epidermolysis bullosa (butterfly skin)', baseExpression: 0.60, bodySystemLinks: ['skin', 'basement_membrane'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FBN1', name: 'Fibrillin 1', chromosome: 15, position: 48700503, category: 'structural', subcategory: 'connective_tissue', description: 'Elastic fiber scaffold protein — mutations cause Marfan syndrome (tall, hypermobile, aortic dissection risk)', baseExpression: 0.65, bodySystemLinks: ['connective_tissue', 'aorta', 'eye', 'skeleton'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ELN', name: 'Elastin', chromosome: 7, position: 74028172, category: 'structural', subcategory: 'connective_tissue', description: 'Gives tissues elastic recoil — lungs, arteries, skin. No turnover in adults: your arterial elastin is as old as you are', baseExpression: 0.60, bodySystemLinks: ['arteries', 'lung', 'skin', 'elastic_recoil'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KRT14', name: 'Keratin 14', chromosome: 17, position: 39737429, category: 'structural', subcategory: 'skin', description: 'Basal epidermal keratin — forms the cytoskeleton of skin stem cells. Mutations cause epidermolysis bullosa simplex', baseExpression: 0.70, bodySystemLinks: ['skin', 'epidermis', 'intermediate_filament'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KRT5', name: 'Keratin 5', chromosome: 12, position: 52780200, category: 'structural', subcategory: 'skin', description: 'Partner of KRT14 in basal keratinocytes — together they form the mechanical backbone of the skin', baseExpression: 0.70, bodySystemLinks: ['skin', 'epidermis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FLG', name: 'Filaggrin', chromosome: 1, position: 152285861, category: 'structural', subcategory: 'skin', description: 'Skin barrier protein — loss-of-function mutations are the strongest known risk factor for eczema and asthma', baseExpression: 0.65, bodySystemLinks: ['skin', 'barrier', 'moisture'], snps: [{ id: 'R501X', rs: 'rs61816761', alleles: ['G', 'A'], frequencies: [0.96, 0.04], effects: { 'G/G': { skin_barrier: 0.1, label: 'Normal filaggrin — intact skin barrier' }, 'G/A': { skin_barrier: -0.1, eczema_risk: 0.15, label: 'One null allele — 3x eczema risk, dry skin' }, 'A/A': { skin_barrier: -0.3, eczema_risk: 0.4, label: 'Double null — severely impaired barrier, high eczema/asthma risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ACTN3', name: 'Alpha-actinin 3', chromosome: 11, position: 66560624, category: 'structural', subcategory: 'muscle', description: 'Fast-twitch muscle fiber protein — R577X null allele is almost absent in elite sprinters but common in endurance athletes', baseExpression: 0.60, bodySystemLinks: ['muscle', 'fast_twitch', 'sprint', 'power'], snps: [{ id: 'R577X', rs: 'rs1815739', alleles: ['C', 'T'], frequencies: [0.58, 0.42], effects: { 'C/C': { fast_twitch: 0.15, sprint_power: 0.1, label: 'Full alpha-actinin-3 — sprint/power phenotype' }, 'C/T': { fast_twitch: 0.05, sprint_power: 0.05, label: 'Intermediate — mixed fiber type advantage' }, 'T/T': { fast_twitch: -0.1, endurance: 0.1, label: 'No alpha-actinin-3 — endurance phenotype, more efficient metabolism' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'DMD', name: 'Dystrophin', chromosome: 'X', position: 31137345, category: 'structural', subcategory: 'muscle', description: 'Largest human gene (2.4 Mb) — connects muscle cytoskeleton to extracellular matrix. Absence causes Duchenne muscular dystrophy', baseExpression: 0.70, bodySystemLinks: ['muscle', 'cytoskeleton', 'structural_integrity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RYR1', name: 'Ryanodine receptor 1', chromosome: 19, position: 38924340, category: 'structural', subcategory: 'muscle', description: 'Skeletal muscle calcium release channel — mutations cause malignant hyperthermia (life-threatening reaction to anesthesia)', baseExpression: 0.65, bodySystemLinks: ['muscle', 'calcium', 'excitation_contraction'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'VDR', name: 'Vitamin D receptor', chromosome: 12, position: 47841279, category: 'structural', subcategory: 'bone', description: 'Nuclear receptor for vitamin D — regulates calcium absorption, bone density, immune function, and 200+ genes', baseExpression: 0.60, bodySystemLinks: ['bone', 'calcium', 'immune', 'vitamin_d'], snps: [{ id: 'FokI', rs: 'rs2228570', alleles: ['C', 'T'], frequencies: [0.60, 0.40], effects: { 'C/C': { vdr_activity: 0.1, label: 'More active shorter VDR protein — better calcium absorption' }, 'C/T': { vdr_activity: 0, label: 'Intermediate' }, 'T/T': { vdr_activity: -0.1, label: 'Less active VDR — reduced calcium absorption, may need more vitamin D' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RUNX2', name: 'Runt-related transcription factor 2', chromosome: 6, position: 45328387, category: 'structural', subcategory: 'bone', description: 'Master transcription factor for bone formation — without it, no bones form at all (cleidocranial dysplasia)', baseExpression: 0.55, bodySystemLinks: ['bone', 'osteoblast', 'skeleton'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SOX9', name: 'SRY-box transcription factor 9', chromosome: 17, position: 72121020, category: 'structural', subcategory: 'cartilage', description: 'Master regulator of cartilage formation — also critical for male sex determination downstream of SRY', baseExpression: 0.55, bodySystemLinks: ['cartilage', 'chondrocyte', 'sex_determination'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GDF8', name: 'Myostatin (growth differentiation factor 8)', chromosome: 2, position: 190880700, category: 'structural', subcategory: 'muscle', description: 'Negative regulator of muscle growth — rare loss-of-function mutations produce extreme muscularity (double-muscled phenotype)', baseExpression: 0.55, bodySystemLinks: ['muscle', 'growth_inhibition', 'myostatin'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'down', magnitude: 0.01 }], expressionOutputs: [] });

// Collagen expansion — chromosome 21 and connective tissue
G({ symbol: 'COL6A1', name: 'Collagen type VI alpha 1', chromosome: 21, position: 46034830, category: 'structural', subcategory: 'connective_tissue', description: 'Microfibrillar collagen on chromosome 21 — mutations cause Ullrich congenital muscular dystrophy and Bethlem myopathy', baseExpression: 0.65, bodySystemLinks: ['connective_tissue', 'muscle', 'extracellular_matrix'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'COL6A2', name: 'Collagen type VI alpha 2', chromosome: 21, position: 46098614, category: 'structural', subcategory: 'connective_tissue', description: 'Partner chain of collagen VI — adjacent to COL6A1 on chromosome 21, triplication may contribute to connective tissue features of Down syndrome', baseExpression: 0.65, bodySystemLinks: ['connective_tissue', 'muscle', 'extracellular_matrix'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'COL2A1', name: 'Collagen type II alpha 1', chromosome: 12, position: 47972963, category: 'structural', subcategory: 'cartilage', description: 'Main collagen of cartilage and vitreous humor — mutations cause a spectrum from Stickler syndrome to achondrogenesis', baseExpression: 0.65, bodySystemLinks: ['cartilage', 'eye', 'intervertebral_disc'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'COL3A1', name: 'Collagen type III alpha 1', chromosome: 2, position: 188974372, category: 'structural', subcategory: 'connective_tissue', description: 'Vascular collagen — mutations cause vascular Ehlers-Danlos syndrome (type IV), the most dangerous form with arterial rupture risk', baseExpression: 0.65, bodySystemLinks: ['blood_vessel', 'skin', 'connective_tissue'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Cytoskeleton
G({ symbol: 'ACTB', name: 'Beta-actin', chromosome: 7, position: 5527148, category: 'structural', subcategory: 'cytoskeleton', description: 'Ubiquitous cytoskeletal protein — one of the most abundant proteins in every cell, the universal housekeeper, internal standard for gene expression', baseExpression: 0.90, bodySystemLinks: ['cytoskeleton', 'cell_motility', 'cell_structure'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TUBA1A', name: 'Tubulin alpha 1a', chromosome: 12, position: 49468748, category: 'structural', subcategory: 'cytoskeleton', description: 'Alpha-tubulin for neuronal microtubules — mutations cause lissencephaly (smooth brain) from failed neuronal migration', baseExpression: 0.75, bodySystemLinks: ['microtubule', 'neuronal_migration', 'brain_development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'VIM', name: 'Vimentin', chromosome: 10, position: 17228195, category: 'structural', subcategory: 'cytoskeleton', description: 'Intermediate filament of mesenchymal cells — marker for epithelial-to-mesenchymal transition (EMT) in cancer metastasis', baseExpression: 0.70, bodySystemLinks: ['intermediate_filament', 'mesenchyme', 'wound_healing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DES', name: 'Desmin', chromosome: 2, position: 219419284, category: 'structural', subcategory: 'muscle', description: 'Muscle-specific intermediate filament — links sarcomeres, connects to mitochondria and nucleus, mutations cause desmin myopathy', baseExpression: 0.70, bodySystemLinks: ['muscle', 'sarcomere', 'intermediate_filament'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KRT10', name: 'Keratin 10', chromosome: 17, position: 40801529, category: 'structural', subcategory: 'skin', description: 'Suprabasal epidermal keratin — mutations cause epidermolytic ichthyosis (blistering and thick scaling skin)', baseExpression: 0.70, bodySystemLinks: ['skin', 'epidermis', 'differentiation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KRT18', name: 'Keratin 18', chromosome: 12, position: 52950631, category: 'structural', subcategory: 'epithelium', description: 'Simple epithelial keratin — caspase cleavage fragment (M30) is a biomarker for epithelial apoptosis in liver disease', baseExpression: 0.65, bodySystemLinks: ['epithelium', 'liver', 'apoptosis_marker'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Extracellular matrix proteins
G({ symbol: 'FN1', name: 'Fibronectin 1', chromosome: 2, position: 215360443, category: 'structural', subcategory: 'extracellular_matrix', description: 'Major extracellular matrix glycoprotein — mediates cell adhesion, migration, and wound healing through integrin binding', baseExpression: 0.70, bodySystemLinks: ['extracellular_matrix', 'wound_healing', 'cell_adhesion'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'LAMA2', name: 'Laminin subunit alpha 2 (merosin)', chromosome: 6, position: 129204284, category: 'structural', subcategory: 'extracellular_matrix', description: 'Laminin in muscle and nerve basement membranes — deficiency causes merosin-deficient congenital muscular dystrophy (MDC1A)', baseExpression: 0.65, bodySystemLinks: ['basement_membrane', 'muscle', 'nerve'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TNC', name: 'Tenascin C', chromosome: 9, position: 115028074, category: 'structural', subcategory: 'extracellular_matrix', description: 'Extracellular matrix glycoprotein re-expressed during wound healing and in tumors — modulates cell adhesion and migration', baseExpression: 0.45, bodySystemLinks: ['extracellular_matrix', 'wound_healing', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SPP1', name: 'Osteopontin (secreted phosphoprotein 1)', chromosome: 4, position: 87975649, category: 'structural', subcategory: 'bone', description: 'Bone matrix protein and immune modulator — bridges mineralized bone matrix, also a key cytokine in immune activation and cancer metastasis', baseExpression: 0.55, bodySystemLinks: ['bone', 'immune', 'mineralization', 'cancer'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  SENSORY SYSTEM — vision, hearing, taste, touch, pigmentation (~20 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'OPN1LW', name: 'Long-wave sensitive opsin (red)', chromosome: 'X', position: 154182596, category: 'sensory', subcategory: 'vision', description: 'Red cone photopigment — absorbs ~564nm. Located on X chromosome, explaining why red-green colorblindness is male-predominant', baseExpression: 0.70, bodySystemLinks: ['vision', 'color', 'retina', 'cone'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'OPN1MW', name: 'Medium-wave sensitive opsin (green)', chromosome: 'X', position: 154196582, category: 'sensory', subcategory: 'vision', description: 'Green cone photopigment — absorbs ~534nm. Tandem duplication with red opsin, recombination causes most color vision defects', baseExpression: 0.70, bodySystemLinks: ['vision', 'color', 'retina', 'cone'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'OPN1SW', name: 'Short-wave sensitive opsin (blue)', chromosome: 7, position: 128772401, category: 'sensory', subcategory: 'vision', description: 'Blue cone photopigment — absorbs ~420nm. On autosome (chr7), so tritanopia is autosomal dominant and equally affects both sexes', baseExpression: 0.65, bodySystemLinks: ['vision', 'color', 'retina', 'cone'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RHO', name: 'Rhodopsin', chromosome: 3, position: 129528640, category: 'sensory', subcategory: 'vision', description: 'Rod photopigment for dim-light vision — detects single photons. Mutations cause retinitis pigmentosa (progressive blindness)', baseExpression: 0.70, bodySystemLinks: ['vision', 'night_vision', 'rod', 'retina'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PAX6', name: 'Paired box 6', chromosome: 11, position: 31784780, category: 'sensory', subcategory: 'eye_development', description: 'Master control gene for eye development — conserved from flies to humans. Ectopic expression grows eyes anywhere', baseExpression: 0.50, bodySystemLinks: ['eye', 'lens', 'retina', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GJB2', name: 'Gap junction beta-2 (Connexin 26)', chromosome: 13, position: 20761613, category: 'sensory', subcategory: 'hearing', description: 'Gap junction protein in the cochlea — mutations cause 50% of all congenital nonsyndromic deafness', baseExpression: 0.65, bodySystemLinks: ['hearing', 'cochlea', 'potassium_recycling'], snps: [{ id: '35delG', rs: 'rs80338939', alleles: ['wt', 'del'], frequencies: [0.98, 0.02], effects: { 'wt/wt': { hearing: 0.05, label: 'Normal connexin 26 — intact cochlear gap junctions' }, 'wt/del': { hearing: 0, label: 'Carrier — normal hearing' }, 'del/del': { hearing: -0.5, label: 'Profound congenital deafness — most common genetic cause' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TMC1', name: 'Transmembrane channel-like 1', chromosome: 9, position: 75134891, category: 'sensory', subcategory: 'hearing', description: 'Mechanotransduction channel in hair cells — converts sound vibrations into electrical signals in the cochlea', baseExpression: 0.60, bodySystemLinks: ['hearing', 'hair_cell', 'mechanotransduction'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MYO7A', name: 'Myosin VIIA', chromosome: 11, position: 76839310, category: 'sensory', subcategory: 'hearing', description: 'Motor protein in hair cell stereocilia — mutations cause Usher syndrome type 1B (deafness + progressive blindness)', baseExpression: 0.60, bodySystemLinks: ['hearing', 'stereocilia', 'balance'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TAS2R38', name: 'Bitter taste receptor 38', chromosome: 7, position: 141672604, category: 'sensory', subcategory: 'taste', description: 'PTC/PROP bitter taste receptor — classic genetics demo. Supertasters find broccoli and beer intensely bitter', baseExpression: 0.55, bodySystemLinks: ['taste', 'bitter', 'tongue'], snps: [{ id: 'PAV/AVI', rs: 'rs713598', alleles: ['C', 'G'], frequencies: [0.55, 0.45], effects: { 'C/C': { bitter_sensitivity: 0.2, label: 'PAV/PAV — supertaster, intensely bitter perception' }, 'C/G': { bitter_sensitivity: 0.1, label: 'Medium taster' }, 'G/G': { bitter_sensitivity: -0.2, label: 'AVI/AVI — non-taster, PTC paper tastes like nothing' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TAS1R2', name: 'Sweet taste receptor 1, member 2', chromosome: 1, position: 18848050, category: 'sensory', subcategory: 'taste', description: 'Sweet taste receptor component — forms heterodimer with TAS1R3 to detect sugars, artificial sweeteners, and some amino acids', baseExpression: 0.55, bodySystemLinks: ['taste', 'sweet', 'tongue', 'gut'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TRPV1', name: 'Transient receptor potential vanilloid 1', chromosome: 17, position: 3565968, category: 'sensory', subcategory: 'pain', description: 'The capsaicin (hot pepper) and heat pain receptor — activated above 43C, mediates burning pain sensation', baseExpression: 0.55, bodySystemLinks: ['pain', 'heat_sensing', 'nociception', 'capsaicin'], snps: [{ id: 'I585V', rs: 'rs8065080', alleles: ['C', 'T'], frequencies: [0.62, 0.38], effects: { 'C/C': { pain_sensitivity: 0.05, label: 'Normal TRPV1 — standard heat/pain sensitivity' }, 'C/T': { pain_sensitivity: 0, label: 'Intermediate' }, 'T/T': { pain_sensitivity: -0.1, label: 'Reduced TRPV1 — lower pain sensitivity, reduced cold sensitivity' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.015 }], expressionOutputs: [{ target: 'norepinephrine', weight: 0.05 }] });

G({ symbol: 'SLC24A5', name: 'Solute carrier family 24 member 5', chromosome: 15, position: 48413169, category: 'sensory', subcategory: 'pigmentation', description: 'Major skin color gene — single SNP (A111T) explains ~25-38% of skin color difference between Europeans and Africans', baseExpression: 0.65, bodySystemLinks: ['pigmentation', 'melanocyte', 'skin_color'], snps: [{ id: 'A111T', rs: 'rs1426654', alleles: ['G', 'A'], frequencies: [0.50, 0.50], effects: { 'G/G': { melanin: 0.15, label: 'Ancestral allele — darker pigmentation' }, 'G/A': { melanin: 0, label: 'Intermediate pigmentation' }, 'A/A': { melanin: -0.15, label: 'Derived allele — lighter pigmentation, nearly fixed in Europeans' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC45A2', name: 'Solute carrier family 45 member 2', chromosome: 5, position: 33944721, category: 'sensory', subcategory: 'pigmentation', description: 'Melanin synthesis transporter — Leu374Phe variant associated with light skin in Europeans', baseExpression: 0.60, bodySystemLinks: ['pigmentation', 'melanocyte'], snps: [{ id: 'Leu374Phe', rs: 'rs16891982', alleles: ['C', 'G'], frequencies: [0.55, 0.45], effects: { 'C/C': { melanin: 0.1, label: 'Ancestral — darker pigmentation' }, 'C/G': { melanin: 0, label: 'Intermediate' }, 'G/G': { melanin: -0.1, label: 'Derived — lighter skin, common in Europeans' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MC1R', name: 'Melanocortin 1 receptor', chromosome: 16, position: 89919436, category: 'sensory', subcategory: 'pigmentation', description: 'Controls eumelanin vs pheomelanin ratio — variants produce red hair, fair skin, and freckling', baseExpression: 0.60, bodySystemLinks: ['pigmentation', 'hair_color', 'melanocyte'], snps: [{ id: 'R151C', rs: 'rs1805007', alleles: ['C', 'T'], frequencies: [0.92, 0.08], effects: { 'C/C': { eumelanin: 0.1, label: 'Full MC1R signaling — dark hair/skin' }, 'C/T': { eumelanin: -0.1, label: 'Carrier — may show red undertones, more freckles' }, 'T/T': { eumelanin: -0.3, red_hair: 0.5, label: 'Red hair, very fair skin, high UV sensitivity' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TYR', name: 'Tyrosinase', chromosome: 11, position: 88911040, category: 'sensory', subcategory: 'pigmentation', description: 'Rate-limiting enzyme of melanin biosynthesis — complete loss causes oculocutaneous albinism type 1', baseExpression: 0.60, bodySystemLinks: ['melanin', 'melanocyte', 'pigmentation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'OCA2', name: 'OCA2 melanosomal transmembrane protein', chromosome: 15, position: 28000020, category: 'sensory', subcategory: 'pigmentation', description: 'Melanosome pH regulator — major determinant of eye color. Albinism type 2 when fully disrupted', baseExpression: 0.60, bodySystemLinks: ['eye_color', 'melanin', 'melanosome'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HERC2', name: 'HECT and RLD domain containing E3 ubiquitin protein ligase 2', chromosome: 15, position: 28356859, category: 'sensory', subcategory: 'pigmentation', description: 'Regulatory variant in HERC2 intron controls OCA2 expression — the primary determinant of blue vs brown eye color', baseExpression: 0.55, bodySystemLinks: ['eye_color', 'oca2_regulation'], snps: [{ id: 'rs12913832', rs: 'rs12913832', alleles: ['A', 'G'], frequencies: [0.50, 0.50], effects: { 'A/A': { blue_eyes: 0.5, label: 'Blue eyes — suppressed OCA2 expression, low iris melanin' }, 'A/G': { blue_eyes: 0.1, label: 'Green/hazel — intermediate OCA2' }, 'G/G': { blue_eyes: -0.3, label: 'Brown eyes — full OCA2 expression, high iris melanin' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'IRF4', name: 'Interferon regulatory factor 4', chromosome: 6, position: 391739, category: 'sensory', subcategory: 'pigmentation', description: 'Transcription factor linking immune and pigmentation — variants associated with skin color, freckling, and sun sensitivity', baseExpression: 0.55, bodySystemLinks: ['pigmentation', 'freckling', 'sun_sensitivity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KCNJ13', name: 'Inwardly-rectifying potassium channel, subfamily J, member 13', chromosome: 2, position: 232832267, category: 'sensory', subcategory: 'vision', description: 'Retinal pigment epithelium potassium channel — mutations cause Leber congenital amaurosis (childhood blindness)', baseExpression: 0.55, bodySystemLinks: ['retina', 'rpe', 'potassium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABCA4', name: 'ATP-binding cassette subfamily A member 4', chromosome: 1, position: 94458393, category: 'sensory', subcategory: 'vision', description: 'Retinal lipid transporter — mutations cause Stargardt disease (juvenile macular degeneration) and cone-rod dystrophy', baseExpression: 0.60, bodySystemLinks: ['retina', 'photoreceptor', 'lipid_transport'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional sensory genes
G({ symbol: 'PIEZO1', name: 'Piezo-type mechanosensitive ion channel component 1', chromosome: 16, position: 88713549, category: 'sensory', subcategory: 'touch', description: 'Mechanosensor for touch, proprioception, and blood pressure sensing — Nobel Prize 2021 for discovery of pressure sensors', baseExpression: 0.60, bodySystemLinks: ['touch', 'mechanotransduction', 'proprioception', 'blood_pressure'], snps: [{ id: 'rs7997033', rs: 'rs7997033', alleles: ['G', 'A'], frequencies: [0.78, 0.22], effects: { 'G/G': { mechanosensation: 0.05, label: 'Normal mechanosensation' }, 'G/A': { mechanosensation: 0, label: 'Intermediate' }, 'A/A': { mechanosensation: -0.05, label: 'Altered mechanosensing — possible lymphedema association' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PIEZO2', name: 'Piezo-type mechanosensitive ion channel component 2', chromosome: 18, position: 10670618, category: 'sensory', subcategory: 'touch', description: 'Primary sensor of gentle touch and proprioception — without it, you cannot feel your body position in space or detect light touch', baseExpression: 0.60, bodySystemLinks: ['touch', 'proprioception', 'merkel_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TRPA1', name: 'Transient receptor potential cation channel A1', chromosome: 8, position: 72936727, category: 'sensory', subcategory: 'pain', description: 'Wasabi/mustard oil receptor — detects chemical irritants, cold, and inflammatory mediators. The "alarm channel" for tissue damage', baseExpression: 0.50, bodySystemLinks: ['pain', 'chemical_sensing', 'inflammation'], snps: [{ id: 'rs920829', rs: 'rs920829', alleles: ['G', 'A'], frequencies: [0.85, 0.15], effects: { 'G/G': { pain_sensitivity: 0, label: 'Normal TRPA1 sensitivity' }, 'G/A': { pain_sensitivity: 0.05, label: 'Slightly enhanced' }, 'A/A': { pain_sensitivity: 0.1, label: 'Higher TRPA1 sensitivity — more reactive to irritants' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'norepinephrine', weight: 0.02 }] });

G({ symbol: 'TRPM8', name: 'Transient receptor potential cation channel M8', chromosome: 2, position: 234731451, category: 'sensory', subcategory: 'temperature', description: 'Menthol and cold receptor — activated below 26C, explains why menthol feels cold and why cold relieves pain', baseExpression: 0.55, bodySystemLinks: ['cold_sensing', 'menthol', 'temperature'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'OR7D4', name: 'Olfactory receptor family 7 subfamily D member 4', chromosome: 19, position: 9289757, category: 'sensory', subcategory: 'smell', description: 'Receptor for androstenone (boar taint compound) — determines if you smell it as pleasant, urinous, or nothing at all', baseExpression: 0.55, bodySystemLinks: ['olfaction', 'smell', 'nasal_epithelium'], snps: [{ id: 'rs61729907', rs: 'rs61729907', alleles: ['C', 'T'], frequencies: [0.80, 0.20], effects: { 'C/C': { androstenone_perception: 0.1, label: 'Can smell androstenone — urinous/sweaty' }, 'C/T': { androstenone_perception: 0, label: 'Intermediate perception' }, 'T/T': { androstenone_perception: -0.1, label: 'Anosmia to androstenone — pleasant or absent' } } }], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  REGULATORY / DNA REPAIR / TUMOR SUPPRESSORS (~15 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'TP53', name: 'Tumor protein p53', chromosome: 17, position: 7661779, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'Guardian of the genome — mutated in >50% of all cancers. Activates DNA repair, arrests cell cycle, or triggers apoptosis', baseExpression: 0.55, bodySystemLinks: ['dna_repair', 'apoptosis', 'cell_cycle', 'cancer'], snps: [{ id: 'Pro72Arg', rs: 'rs1042522', alleles: ['C', 'G'], frequencies: [0.60, 0.40], effects: { 'C/C': { apoptosis_efficiency: -0.05, label: 'Pro72 — better DNA repair, weaker apoptosis' }, 'C/G': { apoptosis_efficiency: 0, label: 'Intermediate' }, 'G/G': { apoptosis_efficiency: 0.1, label: 'Arg72 — stronger apoptosis induction, better cancer killing but faster aging' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'RB1', name: 'Retinoblastoma protein 1', chromosome: 13, position: 48877887, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'First tumor suppressor discovered — guards the G1/S checkpoint. Loss of both copies causes childhood eye cancer', baseExpression: 0.60, bodySystemLinks: ['cell_cycle', 'tumor_suppression'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BRCA1', name: 'Breast cancer 1, early onset', chromosome: 17, position: 43044295, category: 'regulatory', subcategory: 'dna_repair', description: 'Homologous recombination repair of DNA double-strand breaks — mutations carry 60-80% lifetime breast cancer risk', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'breast', 'ovary', 'homologous_recombination'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BRCA2', name: 'Breast cancer 2, early onset', chromosome: 13, position: 32889611, category: 'regulatory', subcategory: 'dna_repair', description: 'Partner of BRCA1 in DNA repair — mutations also increase prostate, pancreatic, and male breast cancer risk', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'breast', 'prostate', 'homologous_recombination'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MYC', name: 'MYC proto-oncogene', chromosome: 8, position: 128748315, category: 'regulatory', subcategory: 'oncogene', description: 'Master transcription factor controlling cell growth — deregulated in 70% of cancers. Drives proliferation, metabolism, and apoptosis', baseExpression: 0.50, bodySystemLinks: ['cell_growth', 'proliferation', 'oncogene'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 60, direction: 'up', magnitude: 0.005 }], expressionOutputs: [] });

G({ symbol: 'KRAS', name: 'KRAS proto-oncogene GTPase', chromosome: 12, position: 25205246, category: 'regulatory', subcategory: 'oncogene', description: 'Molecular switch for cell growth signals — G12D/V/C mutations drive 25% of all cancers, especially pancreatic and lung', baseExpression: 0.55, bodySystemLinks: ['cell_signaling', 'ras_pathway', 'growth'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TERT', name: 'Telomerase reverse transcriptase', chromosome: 5, position: 1253167, category: 'regulatory', subcategory: 'telomere', description: 'Rebuilds telomeres — active in stem cells and cancer. Determines cellular aging: too little = premature aging, too much = cancer', baseExpression: 0.35, bodySystemLinks: ['telomere', 'aging', 'stem_cells', 'cancer'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DNMT1', name: 'DNA methyltransferase 1', chromosome: 19, position: 10133345, category: 'regulatory', subcategory: 'epigenetic', description: 'Maintenance methyltransferase — copies DNA methylation patterns to daughter cells during replication, preserving epigenetic memory', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'methylation', 'gene_silencing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DNMT3A', name: 'DNA methyltransferase 3A', chromosome: 2, position: 25455830, category: 'regulatory', subcategory: 'epigenetic', description: 'De novo methyltransferase — establishes new methylation marks. Frequently mutated in acute myeloid leukemia', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'methylation', 'de_novo'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TET2', name: 'Tet methylcytosine dioxygenase 2', chromosome: 4, position: 105145754, category: 'regulatory', subcategory: 'epigenetic', description: 'Removes DNA methylation marks — enables gene reactivation and epigenetic reprogramming. Mutated in clonal hematopoiesis', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'demethylation', 'hematopoiesis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HDAC1', name: 'Histone deacetylase 1', chromosome: 1, position: 32757687, category: 'regulatory', subcategory: 'epigenetic', description: 'Removes acetyl groups from histones — compacts chromatin and silences genes. Target of HDAC inhibitor cancer drugs', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'histone_modification', 'gene_silencing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'EZH2', name: 'Enhancer of zeste homolog 2', chromosome: 7, position: 148504464, category: 'regulatory', subcategory: 'epigenetic', description: 'H3K27 trimethylase in the PRC2 complex — the master silencer of developmental genes, mutated in lymphoma', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'polycomb', 'gene_silencing', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PTEN', name: 'Phosphatase and tensin homolog', chromosome: 10, position: 87863438, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'Lipid phosphatase opposing PI3K/AKT growth pathway — second most commonly mutated tumor suppressor after TP53', baseExpression: 0.55, bodySystemLinks: ['tumor_suppression', 'pi3k_pathway', 'growth_inhibition'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'APC', name: 'APC regulator of WNT signaling pathway', chromosome: 5, position: 112043195, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'Wnt pathway gatekeeper — germline mutations cause familial adenomatous polyposis (thousands of colon polyps by age 20)', baseExpression: 0.60, bodySystemLinks: ['wnt_pathway', 'colon', 'tumor_suppression'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MLH1', name: 'MutL homolog 1', chromosome: 3, position: 37034841, category: 'regulatory', subcategory: 'dna_repair', description: 'Mismatch repair gene — deficiency causes Lynch syndrome (hereditary nonpolyposis colorectal cancer) and microsatellite instability', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'mismatch_repair', 'colon', 'microsatellite'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// DNA repair family expansion
G({ symbol: 'ATM', name: 'ATM serine/threonine kinase', chromosome: 11, position: 108222484, category: 'regulatory', subcategory: 'dna_repair', description: 'Master DNA damage sensor for double-strand breaks — phosphorylates hundreds of targets. Homozygous loss causes ataxia-telangiectasia', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'cell_cycle_arrest', 'double_strand_break'], snps: [{ id: 'rs1801516', rs: 'rs1801516', alleles: ['G', 'A'], frequencies: [0.85, 0.15], effects: { 'G/G': { dna_repair: 0.05, label: 'Normal ATM kinase function' }, 'G/A': { dna_repair: 0, label: 'Intermediate — mild cancer risk increase' }, 'A/A': { dna_repair: -0.1, label: 'Reduced ATM — radiation sensitivity, breast cancer risk' } } }], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 70, direction: 'up', magnitude: 0.005 }], expressionOutputs: [] });

G({ symbol: 'ATR', name: 'ATR serine/threonine kinase', chromosome: 3, position: 142168077, category: 'regulatory', subcategory: 'dna_repair', description: 'Responds to replication stress and single-strand DNA — essential kinase, complete loss is embryonic lethal. Partial loss causes Seckel syndrome (dwarfism)', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'replication_stress', 'cell_cycle'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CHEK1', name: 'Checkpoint kinase 1', chromosome: 11, position: 125495076, category: 'regulatory', subcategory: 'cell_cycle', description: 'Key effector of ATR — enforces S and G2/M checkpoints. Essential gene (no homozygous null humans exist)', baseExpression: 0.60, bodySystemLinks: ['cell_cycle', 'checkpoint', 'replication'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CHEK2', name: 'Checkpoint kinase 2', chromosome: 22, position: 28687743, category: 'regulatory', subcategory: 'cell_cycle', description: 'Effector of ATM — activates p53 and BRCA1 after DNA damage. Moderate-penetrance breast cancer gene (2-3x risk)', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 'checkpoint', 'p53_activation'], snps: [{ id: '1100delC', rs: 'rs555607708', alleles: ['wt', 'del'], frequencies: [0.99, 0.01], effects: { 'wt/wt': { checkpoint: 0.05, label: 'Normal CHEK2 checkpoint function' }, 'wt/del': { checkpoint: -0.1, breast_cancer_risk: 0.1, label: 'Truncated CHEK2 — 2-3x breast cancer risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RAD51', name: 'RAD51 recombinase', chromosome: 15, position: 40694773, category: 'regulatory', subcategory: 'dna_repair', description: 'Forms nucleoprotein filament on single-strand DNA for homologous recombination — the core recombinase, loaded by BRCA2', baseExpression: 0.55, bodySystemLinks: ['dna_repair', 'homologous_recombination', 'meiosis'], snps: [{ id: 'rs1801320', rs: 'rs1801320', alleles: ['G', 'C'], frequencies: [0.94, 0.06], effects: { 'G/G': { hr_efficiency: 0.05, label: 'Normal RAD51 expression' }, 'G/C': { hr_efficiency: -0.05, label: 'Reduced expression — slightly impaired HR repair' }, 'C/C': { hr_efficiency: -0.1, label: 'Low RAD51 — cancer susceptibility' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'XRCC1', name: 'X-ray repair cross-complementing 1', chromosome: 19, position: 43543070, category: 'regulatory', subcategory: 'dna_repair', description: 'Scaffold protein for base excision repair — coordinates DNA glycosylase, APE1, and DNA ligase III to fix oxidative DNA damage', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'base_excision_repair', 'oxidative_damage'], snps: [{ id: 'Arg399Gln', rs: 'rs25487', alleles: ['G', 'A'], frequencies: [0.63, 0.37], effects: { 'G/G': { ber_efficiency: 0.05, label: 'Normal BER capacity' }, 'G/A': { ber_efficiency: 0, label: 'Intermediate' }, 'A/A': { ber_efficiency: -0.1, label: 'Reduced BER — increased oxidative DNA damage persistence' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'XPC', name: 'XPC complex subunit, DNA damage recognition', chromosome: 3, position: 14143696, category: 'regulatory', subcategory: 'dna_repair', description: 'Recognizes UV-induced DNA damage for nucleotide excision repair — deficiency causes xeroderma pigmentosum group C (extreme sun sensitivity, skin cancer)', baseExpression: 0.55, bodySystemLinks: ['dna_repair', 'nucleotide_excision_repair', 'uv_damage'], snps: [{ id: 'Lys939Gln', rs: 'rs2228001', alleles: ['A', 'C'], frequencies: [0.62, 0.38], effects: { 'A/A': { ner_capacity: 0.05, label: 'Normal NER — adequate UV damage repair' }, 'A/C': { ner_capacity: 0, label: 'Intermediate' }, 'C/C': { ner_capacity: -0.05, label: 'Reduced NER efficiency — higher skin cancer risk with UV' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ERCC1', name: 'ERCC excision repair 1', chromosome: 19, position: 45406897, category: 'regulatory', subcategory: 'dna_repair', description: 'Endonuclease in NER that cuts damaged DNA strand — also required for interstrand crosslink repair, predicts platinum chemotherapy response', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'nucleotide_excision_repair', 'platinum_response'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MSH2', name: 'MutS homolog 2', chromosome: 2, position: 47403067, category: 'regulatory', subcategory: 'dna_repair', description: 'Mismatch recognition with MSH6 — second most common Lynch syndrome gene, deficiency causes microsatellite instability in tumors', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'mismatch_repair', 'lynch_syndrome'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MSH6', name: 'MutS homolog 6', chromosome: 2, position: 47695530, category: 'regulatory', subcategory: 'dna_repair', description: 'Recognizes single base mismatches and small insertions — partners with MSH2 to form MutSalpha, the primary mismatch sensor', baseExpression: 0.60, bodySystemLinks: ['dna_repair', 'mismatch_repair', 'base_mismatch'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PMS2', name: 'PMS1 homolog 2, mismatch repair system component', chromosome: 7, position: 5970925, category: 'regulatory', subcategory: 'dna_repair', description: 'Endonuclease in mismatch repair — cleaves the daughter strand to enable repair. Deficiency causes Lynch syndrome with lower penetrance', baseExpression: 0.55, bodySystemLinks: ['dna_repair', 'mismatch_repair', 'endonuclease'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PARP1', name: 'Poly(ADP-ribose) polymerase 1', chromosome: 1, position: 226360691, category: 'regulatory', subcategory: 'dna_repair', description: 'First responder to DNA single-strand breaks — PARylates histones to recruit repair factors. PARP inhibitors (olaparib) are synthetic lethal with BRCA mutations', baseExpression: 0.65, bodySystemLinks: ['dna_repair', 'single_strand_break', 'chromatin'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Cell cycle regulators
G({ symbol: 'CDK1', name: 'Cyclin-dependent kinase 1', chromosome: 10, position: 60779929, category: 'regulatory', subcategory: 'cell_cycle', description: 'The only essential CDK — drives entry into mitosis by phosphorylating >70 substrates. The original MPF (maturation promoting factor)', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 'mitosis', 'cdc2'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDK2', name: 'Cyclin-dependent kinase 2', chromosome: 12, position: 55966769, category: 'regulatory', subcategory: 'cell_cycle', description: 'Drives S phase entry and DNA replication initiation — partners with cyclin E at G1/S and cyclin A through S phase', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 's_phase', 'dna_replication'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDK4', name: 'Cyclin-dependent kinase 4', chromosome: 12, position: 57747727, category: 'regulatory', subcategory: 'cell_cycle', description: 'G1 phase kinase with cyclin D — phosphorylates RB to release E2F transcription factors. Target of palbociclib in breast cancer', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 'g1_phase', 'rb_phosphorylation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDK6', name: 'Cyclin-dependent kinase 6', chromosome: 7, position: 92234235, category: 'regulatory', subcategory: 'cell_cycle', description: 'Partners with CDK4 in G1 — also has kinase-independent role in transcription, amplified in some lymphomas and glioblastomas', baseExpression: 0.50, bodySystemLinks: ['cell_cycle', 'g1_phase', 'hematopoiesis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CCND1', name: 'Cyclin D1', chromosome: 11, position: 69455855, category: 'regulatory', subcategory: 'cell_cycle', description: 'G1 cyclin activated by mitogen signaling — amplified in breast cancer, mantle cell lymphoma, and many other cancers', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 'g1_phase', 'mitogen_response'], snps: [{ id: 'G870A', rs: 'rs9344', alleles: ['G', 'A'], frequencies: [0.57, 0.43], effects: { 'G/G': { splice_variant: 0, label: 'Normal cyclin D1 splicing' }, 'G/A': { splice_variant: 0.05, label: 'Intermediate' }, 'A/A': { splice_variant: 0.1, label: 'More stable splice variant — possible cancer risk increase' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CCNE1', name: 'Cyclin E1', chromosome: 19, position: 29811991, category: 'regulatory', subcategory: 'cell_cycle', description: 'G1/S transition cyclin — activates CDK2 for S phase entry. Amplification drives genomic instability in high-grade serous ovarian cancer', baseExpression: 0.50, bodySystemLinks: ['cell_cycle', 'g1_s_transition', 'dna_replication'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CCNB1', name: 'Cyclin B1', chromosome: 5, position: 68470862, category: 'regulatory', subcategory: 'cell_cycle', description: 'Mitotic cyclin — activates CDK1 to trigger nuclear envelope breakdown and chromosome condensation for cell division', baseExpression: 0.50, bodySystemLinks: ['cell_cycle', 'mitosis', 'nuclear_envelope'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'E2F1', name: 'E2F transcription factor 1', chromosome: 20, position: 32263087, category: 'regulatory', subcategory: 'cell_cycle', description: 'Released when RB is phosphorylated — activates genes for DNA replication. Also induces apoptosis as a safeguard against oncogenic proliferation', baseExpression: 0.50, bodySystemLinks: ['cell_cycle', 'g1_s_transition', 'apoptosis', 'transcription'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDKN2A', name: 'Cyclin-dependent kinase inhibitor 2A (p16/p14ARF)', chromosome: 9, position: 21967751, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'Encodes both p16 and p14ARF from alternative reading frames — p16 inhibits CDK4/6, p14ARF stabilizes p53. Third most deleted gene in cancer', baseExpression: 0.55, bodySystemLinks: ['cell_cycle', 'tumor_suppression', 'senescence'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDKN1A', name: 'Cyclin-dependent kinase inhibitor 1A (p21)', chromosome: 6, position: 36651878, category: 'regulatory', subcategory: 'cell_cycle', description: 'Universal CDK inhibitor induced by p53 — arrests cell cycle after DNA damage, also mediates cellular senescence', baseExpression: 0.50, bodySystemLinks: ['cell_cycle', 'p53_target', 'senescence', 'dna_damage_response'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Apoptosis pathway
G({ symbol: 'BCL2', name: 'B-cell lymphoma 2', chromosome: 18, position: 63123346, category: 'regulatory', subcategory: 'apoptosis', description: 'Anti-apoptotic guardian — prevents cytochrome c release from mitochondria. Discovered via t(14;18) translocation in follicular lymphoma', baseExpression: 0.60, bodySystemLinks: ['apoptosis', 'mitochondria', 'cell_survival'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BCL2L1', name: 'BCL-extra large (Bcl-xL)', chromosome: 20, position: 31664452, category: 'regulatory', subcategory: 'apoptosis', description: 'Anti-apoptotic protein protecting platelets and neurons — target of navitoclax/venetoclax-like drugs, causes thrombocytopenia when inhibited', baseExpression: 0.60, bodySystemLinks: ['apoptosis', 'platelet', 'neuron', 'cell_survival'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BAX', name: 'BCL2 associated X, apoptosis regulator', chromosome: 19, position: 48954815, category: 'regulatory', subcategory: 'apoptosis', description: 'Pro-apoptotic effector — oligomerizes in the outer mitochondrial membrane to release cytochrome c and execute cell death', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'mitochondria', 'cytochrome_c_release'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CASP3', name: 'Caspase 3', chromosome: 4, position: 184627696, category: 'regulatory', subcategory: 'apoptosis', description: 'Executioner caspase — cleaves hundreds of cellular proteins to dismantle the cell during apoptosis. The point of no return', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'execution', 'proteolysis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CASP8', name: 'Caspase 8', chromosome: 2, position: 201233393, category: 'regulatory', subcategory: 'apoptosis', description: 'Initiator caspase of the extrinsic (death receptor) pathway — activated by Fas, TRAIL, and TNF receptor signaling', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'extrinsic_pathway', 'death_receptor'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CASP9', name: 'Caspase 9', chromosome: 1, position: 15818617, category: 'regulatory', subcategory: 'apoptosis', description: 'Initiator caspase of the intrinsic (mitochondrial) pathway — activated in the apoptosome with APAF1 and cytochrome c', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'intrinsic_pathway', 'apoptosome'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CYCS', name: 'Cytochrome c, somatic', chromosome: 7, position: 25095028, category: 'regulatory', subcategory: 'apoptosis', description: 'Dual function: electron carrier in mitochondrial respiration AND death signal when released to cytoplasm to trigger the apoptosome', baseExpression: 0.70, bodySystemLinks: ['mitochondria', 'electron_transport', 'apoptosis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'APAF1', name: 'Apoptotic peptidase activating factor 1', chromosome: 12, position: 98580283, category: 'regulatory', subcategory: 'apoptosis', description: 'Scaffold of the apoptosome — oligomerizes with cytochrome c to activate caspase-9, the molecular death machine', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'apoptosome', 'caspase_activation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BID', name: 'BH3-interacting domain death agonist', chromosome: 22, position: 17259797, category: 'regulatory', subcategory: 'apoptosis', description: 'Bridges extrinsic and intrinsic apoptosis — caspase-8 cleaves BID to tBID, which activates BAX on mitochondria', baseExpression: 0.50, bodySystemLinks: ['apoptosis', 'crosstalk', 'mitochondria'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Epigenetic modifiers expansion
G({ symbol: 'DNMT3B', name: 'DNA methyltransferase 3B', chromosome: 20, position: 32780894, category: 'regulatory', subcategory: 'epigenetic', description: 'De novo methyltransferase specializing in repetitive elements — mutations cause ICF syndrome (immune deficiency, centromeric instability, facial anomalies)', baseExpression: 0.50, bodySystemLinks: ['epigenetics', 'methylation', 'repeat_silencing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TET1', name: 'Tet methylcytosine dioxygenase 1', chromosome: 10, position: 68560216, category: 'regulatory', subcategory: 'epigenetic', description: 'Oxidizes 5-methylcytosine to 5-hydroxymethylcytosine — the first step of active DNA demethylation, enriched in embryonic stem cells', baseExpression: 0.50, bodySystemLinks: ['epigenetics', 'demethylation', 'stem_cell', 'pluripotency'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HDAC2', name: 'Histone deacetylase 2', chromosome: 6, position: 114244843, category: 'regulatory', subcategory: 'epigenetic', description: 'Deacetylates histones in NuRD and Sin3 complexes — critical for synaptic plasticity and memory formation in the brain', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'histone_modification', 'memory'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HDAC3', name: 'Histone deacetylase 3', chromosome: 5, position: 141023940, category: 'regulatory', subcategory: 'epigenetic', description: 'Unique HDAC that also deacetylates non-histone proteins — regulates circadian clock, liver metabolism, and cardiac development', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'circadian', 'liver_metabolism'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KAT2A', name: 'Lysine acetyltransferase 2A (GCN5)', chromosome: 17, position: 41793093, category: 'regulatory', subcategory: 'epigenetic', description: 'Histone acetyltransferase — first HAT discovered, opens chromatin to activate gene expression', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'histone_acetylation', 'gene_activation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'EP300', name: 'E1A-binding protein p300', chromosome: 22, position: 41092592, category: 'regulatory', subcategory: 'epigenetic', description: 'Transcriptional co-activator and histone acetyltransferase — integrates signals from hundreds of transcription factors. Rubinstein-Taybi syndrome gene', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'transcription', 'histone_acetylation', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KDM1A', name: 'Lysine demethylase 1A (LSD1)', chromosome: 1, position: 23019448, category: 'regulatory', subcategory: 'epigenetic', description: 'First histone demethylase discovered — removes mono/dimethyl marks from H3K4 and H3K9, regulates neuronal gene expression', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'histone_demethylation', 'neurodevelopment'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'KDM6A', name: 'Lysine demethylase 6A (UTX)', chromosome: 'X', position: 44732423, category: 'regulatory', subcategory: 'epigenetic', description: 'H3K27 demethylase that opposes EZH2 — escapes X-inactivation, explaining sex differences in cancer. Kabuki syndrome gene', baseExpression: 0.55, bodySystemLinks: ['epigenetics', 'histone_demethylation', 'development', 'cancer'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Transcription factors
G({ symbol: 'SOX2', name: 'SRY-box transcription factor 2', chromosome: 3, position: 181712259, category: 'regulatory', subcategory: 'transcription_factor', description: 'Yamanaka pluripotency factor — one of four genes that can reprogram adult cells into induced pluripotent stem cells (Nobel Prize 2012)', baseExpression: 0.40, bodySystemLinks: ['pluripotency', 'stem_cell', 'neural_development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'POU5F1', name: 'POU class 5 homeobox 1 (OCT4)', chromosome: 6, position: 31164359, category: 'regulatory', subcategory: 'transcription_factor', description: 'Master pluripotency transcription factor — maintains embryonic stem cell self-renewal, silenced in all adult cells except germ cells', baseExpression: 0.35, bodySystemLinks: ['pluripotency', 'embryonic_development', 'stem_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NANOG', name: 'Nanog homeobox', chromosome: 12, position: 7789523, category: 'regulatory', subcategory: 'transcription_factor', description: 'Named after Tir na nOg (land of eternal youth) — maintains pluripotency downstream of OCT4 and SOX2, prevents differentiation', baseExpression: 0.35, bodySystemLinks: ['pluripotency', 'stem_cell', 'self_renewal'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'JUN', name: 'Jun proto-oncogene, AP-1 transcription factor subunit', chromosome: 1, position: 58780791, category: 'regulatory', subcategory: 'transcription_factor', description: 'AP-1 component responding to growth factors, stress, and cytokines — one of the first immediate-early genes discovered', baseExpression: 0.50, bodySystemLinks: ['transcription', 'stress_response', 'growth'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 55, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'FOS', name: 'Fos proto-oncogene, AP-1 transcription factor subunit', chromosome: 14, position: 75278826, category: 'regulatory', subcategory: 'transcription_factor', description: 'Immediate-early gene — expressed within minutes of neuronal activation, used as a marker to map active brain regions', baseExpression: 0.40, bodySystemLinks: ['transcription', 'neuronal_activity', 'learning'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.02 }], expressionOutputs: [] });

G({ symbol: 'STAT3', name: 'Signal transducer and activator of transcription 3', chromosome: 17, position: 42313324, category: 'regulatory', subcategory: 'transcription_factor', description: 'JAK-STAT pathway effector — constitutively activated in many cancers, also critical for Th17 differentiation and wound healing', baseExpression: 0.55, bodySystemLinks: ['jak_stat', 'immune', 'cancer', 'wound_healing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Chromosome 21 — transcription factors and signaling
G({ symbol: 'RUNX1', name: 'RUNX family transcription factor 1', chromosome: 21, position: 34787801, category: 'regulatory', subcategory: 'transcription_factor', description: 'Master regulator of blood cell development — t(8;21) translocation is the most common chromosomal abnormality in acute myeloid leukemia', baseExpression: 0.55, bodySystemLinks: ['hematopoiesis', 'leukemia', 'megakaryocyte'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ERG', name: 'ETS transcription factor ERG', chromosome: 21, position: 38380027, category: 'regulatory', subcategory: 'transcription_factor', description: 'ETS family member on chromosome 21 — TMPRSS2-ERG fusion drives 50% of prostate cancers, also critical for angiogenesis and hematopoiesis', baseExpression: 0.50, bodySystemLinks: ['angiogenesis', 'hematopoiesis', 'prostate'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ETS2', name: 'ETS proto-oncogene 2, transcription factor', chromosome: 21, position: 39755131, category: 'regulatory', subcategory: 'transcription_factor', description: 'Transcription factor on chromosome 21 — overexpression from trisomy contributes to craniofacial features and immune alterations in Down syndrome', baseExpression: 0.50, bodySystemLinks: ['transcription', 'development', 'immune_regulation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Developmental genes — HOX clusters and signaling
G({ symbol: 'HOXA1', name: 'Homeobox A1', chromosome: 7, position: 27095003, category: 'regulatory', subcategory: 'development', description: 'First HOX gene expressed in embryogenesis — patterns the hindbrain and inner ear. Loss causes Bosley-Salih-Alorainy syndrome', baseExpression: 0.40, bodySystemLinks: ['development', 'hindbrain', 'inner_ear', 'hox'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXA5', name: 'Homeobox A5', chromosome: 7, position: 27141927, category: 'regulatory', subcategory: 'development', description: 'Specifies cervical vertebral identity and lung branching — also a p53 activator, silenced in breast cancer by methylation', baseExpression: 0.40, bodySystemLinks: ['development', 'vertebral_patterning', 'lung'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXA9', name: 'Homeobox A9', chromosome: 7, position: 27169600, category: 'regulatory', subcategory: 'development', description: 'Critical for hematopoietic stem cell self-renewal — most frequently activated HOX gene in acute leukemia', baseExpression: 0.40, bodySystemLinks: ['hematopoiesis', 'stem_cell', 'leukemia'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXA13', name: 'Homeobox A13', chromosome: 7, position: 27209181, category: 'regulatory', subcategory: 'development', description: 'Patterns distal limb (hand/foot) and urogenital tract — mutations cause hand-foot-genital syndrome', baseExpression: 0.35, bodySystemLinks: ['development', 'limb', 'digit_patterning', 'urogenital'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXB4', name: 'Homeobox B4', chromosome: 17, position: 48541535, category: 'regulatory', subcategory: 'development', description: 'Expands hematopoietic stem cells without causing leukemia — one of the most studied HOX genes for ex vivo stem cell expansion', baseExpression: 0.40, bodySystemLinks: ['hematopoiesis', 'stem_cell', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXC8', name: 'Homeobox C8', chromosome: 12, position: 53867434, category: 'regulatory', subcategory: 'development', description: 'Specifies thoracic vertebral identity — also expressed in adult hair follicles, linked to body hair distribution patterns', baseExpression: 0.40, bodySystemLinks: ['development', 'thoracic_vertebrae', 'hair_follicle'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'HOXD13', name: 'Homeobox D13', chromosome: 2, position: 176093058, category: 'regulatory', subcategory: 'development', description: 'Digit patterning gene — polyalanine expansions cause synpolydactyly (fused extra fingers/toes)', baseExpression: 0.35, bodySystemLinks: ['development', 'digit_patterning', 'limb'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SHH', name: 'Sonic hedgehog signaling molecule', chromosome: 7, position: 155799979, category: 'regulatory', subcategory: 'development', description: 'Named after the video game character — master morphogen patterning the neural tube, limbs, and face. Loss causes holoprosencephaly', baseExpression: 0.40, bodySystemLinks: ['development', 'neural_tube', 'limb_patterning', 'morphogen'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'WNT3A', name: 'Wnt family member 3A', chromosome: 1, position: 227981348, category: 'regulatory', subcategory: 'development', description: 'Canonical Wnt ligand — activates beta-catenin pathway for stem cell maintenance, bone formation, and embryonic axis specification', baseExpression: 0.45, bodySystemLinks: ['wnt_pathway', 'stem_cell', 'bone', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'WNT5A', name: 'Wnt family member 5A', chromosome: 3, position: 55499743, category: 'regulatory', subcategory: 'development', description: 'Non-canonical Wnt ligand — drives cell polarity and migration. Mutations cause Robinow syndrome (short-limbed dwarfism with facial anomalies)', baseExpression: 0.45, bodySystemLinks: ['wnt_pathway', 'cell_polarity', 'limb_development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NOTCH1', name: 'Notch receptor 1', chromosome: 9, position: 136496071, category: 'regulatory', subcategory: 'development', description: 'Juxtacrine signaling receptor — determines cell fate through lateral inhibition. Gain-of-function in T-ALL, loss-of-function in aortic valve disease', baseExpression: 0.55, bodySystemLinks: ['development', 'cell_fate', 'hematopoiesis', 'vasculature'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CTNNB1', name: 'Catenin beta 1 (beta-catenin)', chromosome: 3, position: 41194741, category: 'regulatory', subcategory: 'development', description: 'Dual function: cell adhesion at junctions AND nuclear transcription factor in Wnt signaling — mutated in colon cancer and hepatoblastoma', baseExpression: 0.65, bodySystemLinks: ['wnt_pathway', 'cell_adhesion', 'transcription', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SMAD4', name: 'SMAD family member 4', chromosome: 18, position: 51030213, category: 'regulatory', subcategory: 'signaling', description: 'Central mediator of TGF-beta/BMP signaling — common SMAD required by all receptor-regulated SMADs. Lost in 50% of pancreatic cancers', baseExpression: 0.55, bodySystemLinks: ['tgfb_signaling', 'bmp_signaling', 'pancreas'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'EGFR', name: 'Epidermal growth factor receptor', chromosome: 7, position: 55019017, category: 'regulatory', subcategory: 'growth_signaling', description: 'Receptor tyrosine kinase for EGF — amplified/mutated in lung, brain, and head/neck cancers. Target of gefitinib, erlotinib, and cetuximab', baseExpression: 0.55, bodySystemLinks: ['cell_growth', 'ras_pathway', 'cancer', 'epithelium'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PIK3CA', name: 'Phosphatidylinositol-4,5-bisphosphate 3-kinase catalytic subunit alpha', chromosome: 3, position: 179148114, category: 'regulatory', subcategory: 'growth_signaling', description: 'Catalytic subunit of PI3K — hotspot mutations (E545K, H1047R) are among the most common oncogenic mutations in breast, endometrial, and colon cancer', baseExpression: 0.55, bodySystemLinks: ['pi3k_pathway', 'akt', 'cell_growth', 'cancer'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AKT1', name: 'AKT serine/threonine kinase 1', chromosome: 14, position: 104770318, category: 'regulatory', subcategory: 'growth_signaling', description: 'Central kinase in PI3K/AKT/mTOR growth pathway — promotes cell survival, growth, and metabolism. E17K mutation causes Proteus syndrome', baseExpression: 0.55, bodySystemLinks: ['pi3k_pathway', 'cell_survival', 'growth', 'metabolism'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MTOR', name: 'Mechanistic target of rapamycin kinase', chromosome: 1, position: 11166588, category: 'regulatory', subcategory: 'growth_signaling', description: 'Master growth regulator integrating nutrients, energy, and growth factors — target of rapamycin (from Easter Island soil bacterium)', baseExpression: 0.60, bodySystemLinks: ['cell_growth', 'autophagy', 'protein_synthesis', 'metabolism'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.005 }], expressionOutputs: [] });

G({ symbol: 'BRAF', name: 'B-Raf proto-oncogene, serine/threonine kinase', chromosome: 7, position: 140719327, category: 'regulatory', subcategory: 'oncogene', description: 'MAPK pathway kinase — V600E mutation drives 50% of melanomas and is targeted by vemurafenib/dabrafenib', baseExpression: 0.55, bodySystemLinks: ['mapk_pathway', 'cell_growth', 'melanoma'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  REPRODUCTIVE SYSTEM (~15 genes)
// ═══════════════════════════════════════════════════════════════════════════════

G({ symbol: 'SRY', name: 'Sex-determining region Y', chromosome: 'Y', position: 2786855, category: 'reproductive', subcategory: 'sex_determination', description: 'The master switch for male development — a single transcription factor on the Y chromosome that turns the bipotential gonad into a testis', baseExpression: 0.45, bodySystemLinks: ['testis', 'sex_determination', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FSHR', name: 'Follicle-stimulating hormone receptor', chromosome: 2, position: 49154480, category: 'reproductive', subcategory: 'gonadal', description: 'Ovarian and testicular FSH receptor — drives follicle maturation in females and spermatogenesis in males', baseExpression: 0.50, bodySystemLinks: ['ovary', 'testis', 'fsh', 'fertility'], snps: [{ id: 'Asn680Ser', rs: 'rs6166', alleles: ['A', 'G'], frequencies: [0.50, 0.50], effects: { 'A/A': { fsh_sensitivity: 0.1, label: 'Higher FSH sensitivity — responds well to lower FSH levels' }, 'A/G': { fsh_sensitivity: 0, label: 'Intermediate' }, 'G/G': { fsh_sensitivity: -0.1, label: 'Lower sensitivity — may need higher FSH for ovarian stimulation in IVF' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'LHCGR', name: 'Luteinizing hormone/choriogonadotropin receptor', chromosome: 2, position: 48685086, category: 'reproductive', subcategory: 'gonadal', description: 'LH receptor — triggers ovulation in females and testosterone production in Leydig cells in males', baseExpression: 0.50, bodySystemLinks: ['ovulation', 'testosterone', 'leydig_cells'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AMH', name: 'Anti-Mullerian hormone', chromosome: 19, position: 2249309, category: 'reproductive', subcategory: 'sex_differentiation', description: 'Causes Mullerian duct regression in male fetuses — also a clinical marker of ovarian reserve (egg count) in females', baseExpression: 0.45, bodySystemLinks: ['sex_differentiation', 'ovarian_reserve', 'sertoli_cells'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ZP3', name: 'Zona pellucida glycoprotein 3', chromosome: 7, position: 76050482, category: 'reproductive', subcategory: 'fertilization', description: 'Primary sperm receptor on the egg — initiates the acrosome reaction that allows sperm to penetrate the zona pellucida', baseExpression: 0.45, bodySystemLinks: ['fertilization', 'oocyte', 'sperm_binding'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DAZL', name: 'Deleted in azoospermia-like', chromosome: 3, position: 16626023, category: 'reproductive', subcategory: 'germ_cell', description: 'RNA-binding protein essential for germ cell development — required for both sperm and egg precursor cell survival', baseExpression: 0.45, bodySystemLinks: ['germ_cell', 'meiosis', 'fertility'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SYCP3', name: 'Synaptonemal complex protein 3', chromosome: 12, position: 49955893, category: 'reproductive', subcategory: 'meiosis', description: 'Structural protein of the synaptonemal complex — required for chromosome pairing during meiosis, mutations cause infertility', baseExpression: 0.40, bodySystemLinks: ['meiosis', 'chromosome_pairing', 'fertility'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SPO11', name: 'SPO11 initiator of meiotic double strand breaks', chromosome: 20, position: 56464684, category: 'reproductive', subcategory: 'meiosis', description: 'Deliberately creates DNA double-strand breaks to initiate meiotic recombination — without it, no crossing over occurs', baseExpression: 0.40, bodySystemLinks: ['meiosis', 'recombination', 'dna_break'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CATSPER1', name: 'Cation channel of sperm associated 1', chromosome: 11, position: 65804178, category: 'reproductive', subcategory: 'sperm', description: 'Sperm-specific calcium channel activated by progesterone — essential for hyperactivated motility near the egg', baseExpression: 0.40, bodySystemLinks: ['sperm', 'motility', 'calcium', 'fertilization'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FIGLA', name: 'Folliculogenesis specific bHLH transcription factor', chromosome: 2, position: 70830858, category: 'reproductive', subcategory: 'oocyte', description: 'Master regulator of oocyte-specific gene expression — required for primordial follicle formation and zona pellucida gene activation', baseExpression: 0.40, bodySystemLinks: ['oocyte', 'follicle', 'female_fertility'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BMP15', name: 'Bone morphogenetic protein 15', chromosome: 'X', position: 50910012, category: 'reproductive', subcategory: 'oocyte', description: 'Oocyte-secreted growth factor — paradoxically, heterozygous loss increases ovulation rate (natural twinning)', baseExpression: 0.40, bodySystemLinks: ['oocyte', 'ovulation', 'twinning'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GDF9', name: 'Growth differentiation factor 9', chromosome: 5, position: 132861243, category: 'reproductive', subcategory: 'oocyte', description: 'Oocyte-secreted growth factor working with BMP15 — essential for follicle growth beyond the primary stage', baseExpression: 0.40, bodySystemLinks: ['oocyte', 'follicle_growth', 'fertility'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NOBOX', name: 'NOBOX oogenesis homeobox', chromosome: 7, position: 144097855, category: 'reproductive', subcategory: 'oocyte', description: 'Homeobox transcription factor for oocyte development — mutations cause premature ovarian insufficiency', baseExpression: 0.40, bodySystemLinks: ['oocyte', 'ovarian_reserve'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PGR', name: 'Progesterone receptor', chromosome: 11, position: 101025597, category: 'reproductive', subcategory: 'hormonal', description: 'Nuclear receptor for progesterone — essential for ovulation, uterine receptivity, and pregnancy maintenance', baseExpression: 0.50, bodySystemLinks: ['progesterone', 'uterus', 'ovulation', 'pregnancy'], snps: [{ id: '+331G/A', rs: 'rs10895068', alleles: ['G', 'A'], frequencies: [0.92, 0.08], effects: { 'G/G': { pgr_expression: 0, label: 'Normal PGR expression' }, 'G/A': { pgr_expression: 0.1, label: 'Increased PGR-B isoform — altered progesterone signaling' }, 'A/A': { pgr_expression: 0.2, label: 'High PGR-B — endometriosis and endometrial cancer associations' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'STAR', name: 'Steroidogenic acute regulatory protein', chromosome: 8, position: 37963573, category: 'reproductive', subcategory: 'steroidogenesis', description: 'Cholesterol shuttle into mitochondria — the rate-limiting step of ALL steroid hormone synthesis (cortisol, testosterone, estradiol)', baseExpression: 0.50, bodySystemLinks: ['steroidogenesis', 'cortisol', 'testosterone', 'estrogen', 'adrenal'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.03 }] });


// ═══════════════════════════════════════════════════════════════════════════════
//  RESPIRATORY SYSTEM (~10 genes)
// ═══════════════════════════════════════════════════════════════════════════════

// CFTR already defined in metabolic — cross-reference
G({ symbol: 'SFTPB', name: 'Surfactant protein B', chromosome: 2, position: 85657735, category: 'respiratory', subcategory: 'surfactant', description: 'Essential lung surfactant protein — reduces surface tension to prevent alveolar collapse. Deficiency is fatal in neonates', baseExpression: 0.65, bodySystemLinks: ['lung', 'surfactant', 'alveoli', 'breathing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SFTPC', name: 'Surfactant protein C', chromosome: 8, position: 22012772, category: 'respiratory', subcategory: 'surfactant', description: 'Hydrophobic surfactant protein — mutations cause interstitial lung disease and pulmonary fibrosis in adults', baseExpression: 0.60, bodySystemLinks: ['lung', 'surfactant', 'pulmonary_fibrosis'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SERPINA1', name: 'Alpha-1 antitrypsin (AAT)', chromosome: 14, position: 94843083, category: 'respiratory', subcategory: 'protease_inhibitor', description: 'Protects lungs from neutrophil elastase — deficiency causes emphysema (especially in smokers) and liver disease', baseExpression: 0.65, bodySystemLinks: ['lung', 'protease_inhibition', 'liver', 'emphysema'], snps: [{ id: 'Z allele', rs: 'rs28929474', alleles: ['M', 'Z'], frequencies: [0.97, 0.03], effects: { 'M/M': { aat_level: 0.1, label: 'Normal AAT — full lung protection' }, 'M/Z': { aat_level: -0.1, label: 'Carrier — mild reduction, risk with smoking' }, 'Z/Z': { aat_level: -0.4, label: 'Severe deficiency — emphysema by age 30-40 in smokers, liver disease from misfolded protein' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MUC5AC', name: 'Mucin 5AC', chromosome: 11, position: 1157953, category: 'respiratory', subcategory: 'mucus', description: 'Major airway mucin — overproduced in asthma and COPD, forms the gel layer that traps inhaled pathogens and particles', baseExpression: 0.55, bodySystemLinks: ['airway', 'mucus', 'innate_defense'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 65, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'MUC5B', name: 'Mucin 5B', chromosome: 11, position: 1253927, category: 'respiratory', subcategory: 'mucus', description: 'Mucin linked to idiopathic pulmonary fibrosis — common promoter variant increases IPF risk 6-fold but paradoxically improves survival', baseExpression: 0.55, bodySystemLinks: ['airway', 'mucus', 'pulmonary_fibrosis'], snps: [{ id: 'rs35705950', rs: 'rs35705950', alleles: ['G', 'T'], frequencies: [0.90, 0.10], effects: { 'G/G': { muc5b_expression: 0, label: 'Normal MUC5B levels' }, 'G/T': { muc5b_expression: 0.15, ipf_risk: 0.1, label: 'Elevated MUC5B — 3x IPF risk but better survival if affected' }, 'T/T': { muc5b_expression: 0.3, ipf_risk: 0.2, label: 'High MUC5B — 6x IPF risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ACE2', name: 'Angiotensin-converting enzyme 2', chromosome: 'X', position: 15561033, category: 'respiratory', subcategory: 'receptor', description: 'Carboxypeptidase that counterbalances ACE — also the SARS-CoV-2 entry receptor, explaining COVID-19 lung tropism', baseExpression: 0.55, bodySystemLinks: ['lung', 'sars_cov_2', 'blood_pressure', 'renin_angiotensin'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FOXJ1', name: 'Forkhead box J1', chromosome: 17, position: 75576959, category: 'respiratory', subcategory: 'cilia', description: 'Master transcription factor for motile cilia — required for airway mucus clearance, left-right body asymmetry, and brain CSF flow', baseExpression: 0.55, bodySystemLinks: ['cilia', 'airway_clearance', 'mucociliary'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NKX2-1', name: 'NK2 homeobox 1 (TTF-1)', chromosome: 14, position: 36985602, category: 'respiratory', subcategory: 'lung_development', description: 'Master transcription factor for lung and thyroid development — also expressed in brain, used as a lung cancer diagnostic marker', baseExpression: 0.55, bodySystemLinks: ['lung', 'thyroid', 'surfactant', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SCNN1A', name: 'Epithelial sodium channel alpha subunit', chromosome: 12, position: 6345546, category: 'respiratory', subcategory: 'ion_transport', description: 'ENaC alpha subunit — absorbs sodium from airway surface liquid, controlling the depth of the periciliary layer for mucus clearance', baseExpression: 0.60, bodySystemLinks: ['lung', 'sodium', 'airway_surface_liquid'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'AGER', name: 'Advanced glycosylation end-product specific receptor (RAGE)', chromosome: 6, position: 32148744, category: 'respiratory', subcategory: 'alveolar', description: 'Highly expressed in type I alveolar cells — soluble RAGE is a biomarker for ARDS severity, mediates inflammation', baseExpression: 0.55, bodySystemLinks: ['lung', 'alveoli', 'inflammation', 'ards'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional respiratory
G({ symbol: 'SFTPA1', name: 'Surfactant protein A1', chromosome: 10, position: 79556022, category: 'respiratory', subcategory: 'surfactant', description: 'Collectin surfactant protein — innate immune defense in the lung, opsonizes pathogens for alveolar macrophage clearance', baseExpression: 0.60, bodySystemLinks: ['lung', 'surfactant', 'innate_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SFTPD', name: 'Surfactant protein D', chromosome: 10, position: 79596001, category: 'respiratory', subcategory: 'surfactant', description: 'Collectin for pulmonary host defense — binds influenza, RSV, and SARS-CoV-2, links innate immunity to surfactant biology', baseExpression: 0.55, bodySystemLinks: ['lung', 'innate_immunity', 'pathogen_clearance'], snps: [{ id: 'rs721917', rs: 'rs721917', alleles: ['C', 'T'], frequencies: [0.55, 0.45], effects: { 'C/C': { sftpd_level: 0.1, label: 'Higher SP-D levels — better pathogen clearance' }, 'C/T': { sftpd_level: 0, label: 'Intermediate' }, 'T/T': { sftpd_level: -0.1, label: 'Lower SP-D — increased respiratory infection susceptibility' } } }], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  CHROMOSOME GAP-FILL — chr16, chr18, chr20, chr21, chr22 reinforcements
// ═══════════════════════════════════════════════════════════════════════════════

// Chromosome 16 reinforcements
G({ symbol: 'TSC2', name: 'TSC complex subunit 2 (tuberin)', chromosome: 16, position: 2047578, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'mTOR pathway inhibitor — loss causes tuberous sclerosis (benign tumors in brain, kidney, skin, heart)', baseExpression: 0.60, bodySystemLinks: ['mtor_pathway', 'tumor_suppression', 'brain', 'kidney'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PALB2', name: 'Partner and localizer of BRCA2', chromosome: 16, position: 23603160, category: 'regulatory', subcategory: 'dna_repair', description: 'Bridges BRCA1 and BRCA2 in homologous recombination repair — moderate-penetrance breast cancer gene (35% lifetime risk)', baseExpression: 0.55, bodySystemLinks: ['dna_repair', 'homologous_recombination', 'breast'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABCC12', name: 'ATP-binding cassette subfamily C member 12', chromosome: 16, position: 48027371, category: 'metabolic', subcategory: 'efflux_transport', description: 'ABC transporter expressed in breast tissue — may contribute to drug resistance in breast cancer chemotherapy', baseExpression: 0.45, bodySystemLinks: ['drug_transport', 'breast', 'efflux'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CETP', name: 'Cholesteryl ester transfer protein', chromosome: 16, position: 56961923, category: 'cardiovascular', subcategory: 'lipid', description: 'Transfers cholesterol esters between lipoproteins — deficiency raises HDL dramatically, a natural experiment in longevity', baseExpression: 0.55, bodySystemLinks: ['cholesterol', 'hdl', 'ldl', 'liver'], snps: [{ id: 'rs708272', rs: 'rs708272', alleles: ['C', 'T'], frequencies: [0.57, 0.43], effects: { 'C/C': { cetp_activity: 0.1, label: 'Normal CETP — standard HDL levels' }, 'C/T': { cetp_activity: -0.05, hdl: 0.05, label: 'Intermediate — slightly higher HDL' }, 'T/T': { cetp_activity: -0.15, hdl: 0.15, label: 'Low CETP — high HDL, longevity association' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MC1R', name: 'Melanocortin 1 receptor', chromosome: 16, position: 89919709, category: 'sensory', subcategory: 'pigmentation', description: 'Switch between eumelanin (brown/black) and pheomelanin (red/yellow) — variants cause red hair, fair skin, and increased melanoma risk', baseExpression: 0.55, bodySystemLinks: ['pigmentation', 'melanin', 'skin', 'hair_color'], snps: [{ id: 'R151C', rs: 'rs1805007', alleles: ['C', 'T'], frequencies: [0.92, 0.08], effects: { 'C/C': { eumelanin: 0.1, label: 'Normal MC1R — eumelanin dominant' }, 'C/T': { eumelanin: -0.05, label: 'Carrier — subtle fair skin/freckling' }, 'T/T': { eumelanin: -0.2, label: 'Red hair/fair skin — pheomelanin dominant, higher melanoma risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CREBBP', name: 'CREB-binding protein', chromosome: 16, position: 3726209, category: 'regulatory', subcategory: 'epigenetic', description: 'Histone acetyltransferase and transcriptional co-activator — mutations cause Rubinstein-Taybi syndrome (intellectual disability, broad thumbs)', baseExpression: 0.60, bodySystemLinks: ['epigenetics', 'transcription', 'histone_acetylation', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABAT', name: 'Gamma-aminobutyric acid transaminase', chromosome: 16, position: 8735085, category: 'nervous', subcategory: 'inhibition', description: 'Degrades GABA — target of vigabatrin for epilepsy. Deficiency causes elevated GABA and epileptic encephalopathy', baseExpression: 0.60, bodySystemLinks: ['gaba', 'degradation', 'epilepsy'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: -0.15 }] });

// Chromosome 18 reinforcements
G({ symbol: 'SMAD2', name: 'SMAD family member 2', chromosome: 18, position: 47808957, category: 'regulatory', subcategory: 'signaling', description: 'Receptor-regulated SMAD in TGF-beta pathway — phosphorylated by TGF-beta receptors, partners with SMAD4 for nuclear signaling', baseExpression: 0.55, bodySystemLinks: ['tgfb_signaling', 'development', 'immune_regulation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DCC', name: 'DCC netrin 1 receptor', chromosome: 18, position: 52340172, category: 'nervous', subcategory: 'axon_guidance', description: 'Netrin receptor guiding axon growth across the midline — also a tumor suppressor deleted in colon cancer (Deleted in Colorectal Cancer)', baseExpression: 0.50, bodySystemLinks: ['axon_guidance', 'neural_development', 'tumor_suppression'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TCF4', name: 'Transcription factor 4 (immunoglobulin transcription factor 2)', chromosome: 18, position: 55222185, category: 'nervous', subcategory: 'neurodevelopment', description: 'bHLH transcription factor for cortical development — haploinsufficiency causes Pitt-Hopkins syndrome (severe intellectual disability, characteristic face)', baseExpression: 0.55, bodySystemLinks: ['neurodevelopment', 'cortex', 'transcription'], snps: [{ id: 'rs9960767', rs: 'rs9960767', alleles: ['C', 'A'], frequencies: [0.93, 0.07], effects: { 'C/C': { tcf4_expression: 0.05, label: 'Normal TCF4 expression' }, 'C/A': { tcf4_expression: -0.05, label: 'Slightly altered — schizophrenia risk association' }, 'A/A': { tcf4_expression: -0.1, label: 'Reduced expression — schizophrenia susceptibility' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SETBP1', name: 'SET binding protein 1', chromosome: 18, position: 44521428, category: 'regulatory', subcategory: 'epigenetic', description: 'Chromatin regulator — germline loss-of-function causes Schinzel-Giedion syndrome, somatic gain-of-function drives myeloid malignancies', baseExpression: 0.50, bodySystemLinks: ['chromatin', 'hematopoiesis', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SERPINB2', name: 'Plasminogen activator inhibitor 2', chromosome: 18, position: 63427735, category: 'immune', subcategory: 'inflammation', description: 'Serine protease inhibitor upregulated in monocytes during inflammation — protects cells from apoptosis, placental expression protects pregnancy', baseExpression: 0.45, bodySystemLinks: ['inflammation', 'monocyte', 'placenta', 'protease_inhibition'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CDH7', name: 'Cadherin 7', chromosome: 18, position: 63668267, category: 'structural', subcategory: 'cell_adhesion', description: 'Type II classical cadherin expressed in neural crest cells — mediates cell-cell adhesion during neural crest migration and craniofacial development', baseExpression: 0.45, bodySystemLinks: ['cell_adhesion', 'neural_crest', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Chromosome 20 reinforcements
G({ symbol: 'JAG1', name: 'Jagged canonical Notch ligand 1', chromosome: 20, position: 10618332, category: 'regulatory', subcategory: 'development', description: 'Notch pathway ligand — mutations cause Alagille syndrome (bile duct paucity, cardiac, skeletal, and eye defects)', baseExpression: 0.55, bodySystemLinks: ['notch_pathway', 'liver', 'heart', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PRNP', name: 'Prion protein', chromosome: 20, position: 4666796, category: 'nervous', subcategory: 'neurodegeneration', description: 'Normal cellular prion protein — misfolding creates infectious prions causing Creutzfeldt-Jakob disease, fatal familial insomnia, and kuru', baseExpression: 0.65, bodySystemLinks: ['neurodegeneration', 'prion', 'copper_binding'], snps: [{ id: 'M129V', rs: 'rs1799990', alleles: ['A', 'G'], frequencies: [0.63, 0.37], effects: { 'A/A': { prion_susceptibility: 0.05, label: 'Met/Met — susceptible to sporadic CJD and kuru' }, 'A/G': { prion_susceptibility: 0, label: 'Met/Val — intermediate' }, 'G/G': { prion_susceptibility: -0.05, label: 'Val/Val — resistant to kuru, different CJD profile' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ASIP', name: 'Agouti signaling protein', chromosome: 20, position: 33544266, category: 'sensory', subcategory: 'pigmentation', description: 'Antagonist of MC1R — switches melanocytes from eumelanin to pheomelanin production, determines ventral lightness pattern in mammals', baseExpression: 0.50, bodySystemLinks: ['pigmentation', 'melanin', 'hair_color'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GNAS', name: 'GNAS complex locus', chromosome: 20, position: 58839718, category: 'endocrine', subcategory: 'signaling', description: 'Stimulatory G-protein alpha subunit — imprinted gene, mutations cause McCune-Albright syndrome (polyostotic fibrous dysplasia, precocious puberty)', baseExpression: 0.65, bodySystemLinks: ['g_protein', 'camp', 'endocrine_signaling', 'bone'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CHRNA4', name: 'Cholinergic receptor nicotinic alpha 4 subunit', chromosome: 20, position: 63347525, category: 'nervous', subcategory: 'acetylcholine', description: 'Major brain nicotinic receptor — mutations cause autosomal dominant nocturnal frontal lobe epilepsy, also mediates nicotine reward', baseExpression: 0.55, bodySystemLinks: ['acetylcholine', 'nicotine', 'attention', 'frontal_lobe'], snps: [{ id: 'rs1044396', rs: 'rs1044396', alleles: ['C', 'T'], frequencies: [0.62, 0.38], effects: { 'C/C': { nicotinic_function: 0.05, label: 'Enhanced alpha4 function — better sustained attention' }, 'C/T': { nicotinic_function: 0, label: 'Intermediate' }, 'T/T': { nicotinic_function: -0.05, label: 'Reduced function — attention variability' } } }], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'arousal', weight: 0.05 }] });

G({ symbol: 'PLCG1', name: 'Phospholipase C gamma 1', chromosome: 20, position: 41129764, category: 'regulatory', subcategory: 'signaling', description: 'Downstream effector of receptor tyrosine kinases — generates IP3 and DAG to release calcium stores and activate PKC', baseExpression: 0.60, bodySystemLinks: ['calcium_signaling', 'ip3', 'pkc', 'growth_signaling'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'VAPB', name: 'VAMP-associated protein B and C', chromosome: 20, position: 57824640, category: 'nervous', subcategory: 'motor_neuron', description: 'ER membrane protein — P56S mutation causes ALS8 (autosomal dominant late-onset motor neuron disease found in Brazilian families)', baseExpression: 0.60, bodySystemLinks: ['endoplasmic_reticulum', 'motor_neuron', 'als'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Chromosome 21 additional genes
G({ symbol: 'DSCAM', name: 'DS cell adhesion molecule', chromosome: 21, position: 41382561, category: 'nervous', subcategory: 'neurodevelopment', description: 'Neuronal self-avoidance receptor on chromosome 21 — Drosophila homolog generates 38,016 isoforms for neuron identity, overexpression in Down syndrome', baseExpression: 0.55, bodySystemLinks: ['neural_development', 'dendrite', 'self_avoidance'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BACE2', name: 'Beta-secretase 2', chromosome: 21, position: 42539629, category: 'nervous', subcategory: 'neurodegeneration', description: 'Homolog of BACE1 (the beta-secretase that generates amyloid-beta) — chromosome 21 location relevant to Alzheimer pathology in Down syndrome', baseExpression: 0.50, bodySystemLinks: ['amyloid', 'alzheimer', 'protease'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ITSN1', name: 'Intersectin 1', chromosome: 21, position: 33547843, category: 'nervous', subcategory: 'synapse', description: 'Scaffold protein for endocytosis and signaling at synapses — overexpression from trisomy 21 may contribute to synaptic dysfunction in Down syndrome', baseExpression: 0.55, bodySystemLinks: ['endocytosis', 'synapse', 'signaling'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PFKL', name: 'Phosphofructokinase, liver type', chromosome: 21, position: 44826647, category: 'metabolic', subcategory: 'glycolysis', description: 'Rate-limiting glycolytic enzyme on chromosome 21 — liver isoform, triplication alters glucose metabolism in Down syndrome', baseExpression: 0.60, bodySystemLinks: ['glycolysis', 'liver', 'glucose_metabolism'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Chromosome 22 reinforcements
G({ symbol: 'TBX1', name: 'T-box transcription factor 1', chromosome: 22, position: 19744226, category: 'regulatory', subcategory: 'development', description: 'Key gene in 22q11.2 deletion (DiGeorge/velocardiofacial syndrome) — patterns the pharyngeal arches for heart, thymus, and face development', baseExpression: 0.50, bodySystemLinks: ['development', 'heart', 'thymus', 'craniofacial'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'DGCR8', name: 'DGCR8 microprocessor complex subunit', chromosome: 22, position: 19069757, category: 'regulatory', subcategory: 'rna_processing', description: 'Essential for microRNA biogenesis — partners with Drosha to process pri-miRNAs. Hemizygous loss in 22q11.2 deletion disrupts miRNA networks', baseExpression: 0.60, bodySystemLinks: ['microrna', 'rna_processing', 'gene_regulation'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'BCR', name: 'BCR activator of RhoGEF and GTPase', chromosome: 22, position: 23180509, category: 'regulatory', subcategory: 'oncogene', description: 'Breakpoint cluster region — t(9;22) Philadelphia chromosome creates BCR-ABL fusion driving CML, target of imatinib (Gleevec) revolution', baseExpression: 0.55, bodySystemLinks: ['signaling', 'leukemia', 'tyrosine_kinase'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NF2', name: 'Neurofibromin 2 (Merlin)', chromosome: 22, position: 29603555, category: 'regulatory', subcategory: 'tumor_suppressor', description: 'Cytoskeletal-membrane linker and Hippo pathway activator — loss causes neurofibromatosis type 2 (bilateral vestibular schwannomas)', baseExpression: 0.55, bodySystemLinks: ['tumor_suppression', 'hippo_pathway', 'schwann_cell'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MYH9', name: 'Myosin heavy chain 9 (non-muscle)', chromosome: 22, position: 36281300, category: 'structural', subcategory: 'cytoskeleton', description: 'Non-muscle myosin IIA — mutations cause MYH9-related disorders (giant platelets, hearing loss, kidney disease)', baseExpression: 0.65, bodySystemLinks: ['cytoskeleton', 'platelet', 'kidney', 'hearing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MAPK1', name: 'Mitogen-activated protein kinase 1 (ERK2)', chromosome: 22, position: 21754500, category: 'regulatory', subcategory: 'signaling', description: 'Terminal kinase of the RAS/RAF/MEK/ERK cascade — phosphorylates hundreds of substrates to control growth, differentiation, and survival', baseExpression: 0.60, bodySystemLinks: ['mapk_pathway', 'cell_growth', 'differentiation'], snps: [], expressionDrivers: [{ trigger: 'arousal', threshold: 50, direction: 'up', magnitude: 0.005 }], expressionOutputs: [] });

G({ symbol: 'PRODH', name: 'Proline dehydrogenase 1', chromosome: 22, position: 18900293, category: 'metabolic', subcategory: 'amino_acid', description: 'Mitochondrial proline catabolism enzyme — hemizygous in 22q11.2 deletion, hyperprolinemia associated with schizophrenia risk', baseExpression: 0.55, bodySystemLinks: ['proline', 'mitochondria', 'schizophrenia_risk'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SNAP29', name: 'Synaptosome-associated protein 29', chromosome: 22, position: 20856813, category: 'nervous', subcategory: 'synapse', description: 'SNARE protein for membrane fusion — hemizygous loss in 22q11.2 deletion may contribute to synaptic and autophagy defects', baseExpression: 0.55, bodySystemLinks: ['snare', 'membrane_fusion', 'autophagy'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  ADDITIONAL SIGNALING, METABOLISM, AND GAP-FILL GENES
// ═══════════════════════════════════════════════════════════════════════════════

// WNT signaling expansion
G({ symbol: 'WNT1', name: 'Wnt family member 1', chromosome: 12, position: 49309804, category: 'regulatory', subcategory: 'development', description: 'First Wnt gene discovered (originally int-1 oncogene) — essential for midbrain development and osteoblast differentiation', baseExpression: 0.40, bodySystemLinks: ['wnt_pathway', 'midbrain', 'bone', 'development'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'WNT7A', name: 'Wnt family member 7A', chromosome: 3, position: 13827087, category: 'regulatory', subcategory: 'development', description: 'Patterns the dorsal limb and uterine glands — mutations cause Al-Awadi/Raas-Rothschild/Schinzel phocomelia (severe limb malformations)', baseExpression: 0.40, bodySystemLinks: ['wnt_pathway', 'limb_patterning', 'uterus'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional metabolic enzymes
G({ symbol: 'PPARA', name: 'Peroxisome proliferator-activated receptor alpha', chromosome: 22, position: 46150521, category: 'metabolic', subcategory: 'lipid_metabolism', description: 'Nuclear receptor for fatty acid oxidation — target of fibrate drugs for high triglycerides, master regulator of fasting metabolism', baseExpression: 0.55, bodySystemLinks: ['fatty_acid', 'liver', 'fasting', 'ketogenesis'], snps: [{ id: 'L162V', rs: 'rs1800206', alleles: ['C', 'G'], frequencies: [0.93, 0.07], effects: { 'C/C': { lipid_metabolism: 0, label: 'Normal PPARalpha activity' }, 'C/G': { lipid_metabolism: 0.05, label: 'Enhanced fatty acid oxidation' }, 'G/G': { lipid_metabolism: 0.1, label: 'High PPARalpha activity — lower triglycerides' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'UGT1A1', name: 'UDP glucuronosyltransferase family 1 member A1', chromosome: 2, position: 233760234, category: 'metabolic', subcategory: 'conjugation', description: 'Conjugates bilirubin for excretion — promoter variant causes Gilbert syndrome (benign jaundice in 5-10% of population)', baseExpression: 0.60, bodySystemLinks: ['bilirubin', 'liver', 'drug_metabolism'], snps: [{ id: 'UGT1A1*28', rs: 'rs8175347', alleles: ['6TA', '7TA'], frequencies: [0.65, 0.35], effects: { '6TA/6TA': { bilirubin_clearance: 0.1, label: 'Normal bilirubin conjugation' }, '6TA/7TA': { bilirubin_clearance: -0.05, label: 'Carrier — mildly elevated bilirubin' }, '7TA/7TA': { bilirubin_clearance: -0.2, label: 'Gilbert syndrome — benign unconjugated hyperbilirubinemia, irinotecan toxicity risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'NAT2', name: 'N-acetyltransferase 2', chromosome: 8, position: 18248755, category: 'metabolic', subcategory: 'drug_metabolism', description: 'Acetylates isoniazid, caffeine, and aromatic amines — classic pharmacogenetic gene, slow acetylators get isoniazid toxicity', baseExpression: 0.55, bodySystemLinks: ['liver', 'drug_metabolism', 'acetylation'], snps: [{ id: 'rs1799930', rs: 'rs1799930', alleles: ['G', 'A'], frequencies: [0.72, 0.28], effects: { 'G/G': { acetylation_rate: 0.1, label: 'Rapid acetylator — fast isoniazid clearance' }, 'G/A': { acetylation_rate: 0, label: 'Intermediate acetylator' }, 'A/A': { acetylation_rate: -0.15, label: 'Slow acetylator — isoniazid toxicity risk, higher bladder cancer risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GSTP1', name: 'Glutathione S-transferase Pi 1', chromosome: 11, position: 67585218, category: 'metabolic', subcategory: 'detoxification', description: 'Phase II detoxification enzyme — conjugates glutathione to electrophilic compounds, polymorphisms affect cancer susceptibility and drug response', baseExpression: 0.60, bodySystemLinks: ['detoxification', 'glutathione', 'liver', 'lung'], snps: [{ id: 'Ile105Val', rs: 'rs1695', alleles: ['A', 'G'], frequencies: [0.68, 0.32], effects: { 'A/A': { gst_activity: 0.1, label: 'Normal GSTP1 activity — good detoxification' }, 'A/G': { gst_activity: 0, label: 'Intermediate' }, 'G/G': { gst_activity: -0.1, label: 'Reduced detoxification — higher oxidative stress from toxins' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SOD2', name: 'Superoxide dismutase 2 (mitochondrial)', chromosome: 6, position: 159669069, category: 'metabolic', subcategory: 'antioxidant', description: 'Mitochondrial antioxidant — converts superoxide to hydrogen peroxide, essential for mitochondrial health and cellular defense', baseExpression: 0.70, bodySystemLinks: ['antioxidant', 'mitochondria', 'oxidative_stress'], snps: [{ id: 'Ala16Val', rs: 'rs4880', alleles: ['C', 'T'], frequencies: [0.53, 0.47], effects: { 'C/C': { sod2_activity: 0.1, label: 'Ala/Ala — efficient mitochondrial import, high SOD2 activity' }, 'C/T': { sod2_activity: 0, label: 'Intermediate' }, 'T/T': { sod2_activity: -0.1, label: 'Val/Val — slower import, reduced mitochondrial antioxidant defense' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CAT', name: 'Catalase', chromosome: 11, position: 34438925, category: 'metabolic', subcategory: 'antioxidant', description: 'Decomposes hydrogen peroxide to water and oxygen — among the fastest enzymes known (40 million molecules/second), critical cellular protector', baseExpression: 0.70, bodySystemLinks: ['antioxidant', 'peroxisome', 'hydrogen_peroxide'], snps: [{ id: 'rs1001179', rs: 'rs1001179', alleles: ['C', 'T'], frequencies: [0.80, 0.20], effects: { 'C/C': { catalase_activity: 0.05, label: 'Normal catalase expression' }, 'C/T': { catalase_activity: 0, label: 'Intermediate' }, 'T/T': { catalase_activity: -0.1, label: 'Reduced catalase — higher H2O2 levels, graying hair association' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GPX1', name: 'Glutathione peroxidase 1', chromosome: 3, position: 49357164, category: 'metabolic', subcategory: 'antioxidant', description: 'Selenium-dependent enzyme that reduces hydrogen peroxide using glutathione — first line of antioxidant defense in every cell', baseExpression: 0.65, bodySystemLinks: ['antioxidant', 'selenium', 'glutathione', 'oxidative_stress'], snps: [{ id: 'Pro198Leu', rs: 'rs1050450', alleles: ['C', 'T'], frequencies: [0.75, 0.25], effects: { 'C/C': { gpx_activity: 0.05, label: 'Normal GPX1 — good selenoprotein function' }, 'C/T': { gpx_activity: 0, label: 'Intermediate' }, 'T/T': { gpx_activity: -0.1, label: 'Reduced GPX1 — increased oxidative vulnerability' } } }], expressionDrivers: [], expressionOutputs: [] });

// Additional cardiovascular/endocrine
G({ symbol: 'ADIPOQ', name: 'Adiponectin', chromosome: 3, position: 186841700, category: 'endocrine', subcategory: 'adipokine', description: 'Anti-diabetic adipokine — paradoxically high in lean people and low in obesity, protects against insulin resistance and atherosclerosis', baseExpression: 0.55, bodySystemLinks: ['adipose', 'insulin_sensitivity', 'anti_inflammatory'], snps: [{ id: 'rs1501299', rs: 'rs1501299', alleles: ['G', 'T'], frequencies: [0.72, 0.28], effects: { 'G/G': { adiponectin_level: 0, label: 'Normal adiponectin levels' }, 'G/T': { adiponectin_level: 0.05, label: 'Slightly higher — better insulin sensitivity' }, 'T/T': { adiponectin_level: 0.1, label: 'Higher adiponectin — metabolic protection' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GCG', name: 'Glucagon', chromosome: 2, position: 162142677, category: 'endocrine', subcategory: 'glucose', description: 'Counter-regulatory hormone to insulin — raises blood glucose from liver glycogen. Same gene encodes GLP-1 (incretin, basis of semaglutide)', baseExpression: 0.55, bodySystemLinks: ['glucose', 'pancreas', 'liver', 'glp1'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GLP1R', name: 'Glucagon-like peptide 1 receptor', chromosome: 6, position: 39016557, category: 'endocrine', subcategory: 'glucose', description: 'Receptor for GLP-1 incretin — target of semaglutide (Ozempic/Wegovy) for diabetes and obesity, the fastest-growing drug class in history', baseExpression: 0.55, bodySystemLinks: ['glp1', 'insulin_secretion', 'appetite', 'weight'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional nervous system — neurotrophins and signaling
G({ symbol: 'NTRK2', name: 'Neurotrophic receptor tyrosine kinase 2 (TrkB)', chromosome: 9, position: 84667825, category: 'nervous', subcategory: 'neuroplasticity', description: 'BDNF receptor — mediates all BDNF effects on neuronal survival, plasticity, and synaptic strengthening. Target of novel antidepressants', baseExpression: 0.60, bodySystemLinks: ['neuroplasticity', 'bdnf', 'neuron_survival'], snps: [], expressionDrivers: [{ trigger: 'serotonin', threshold: 50, direction: 'up', magnitude: 0.01 }], expressionOutputs: [{ target: 'serotonin', weight: 0.03 }, { target: 'valence', weight: 0.03 }] });

G({ symbol: 'NGF', name: 'Nerve growth factor', chromosome: 1, position: 115286400, category: 'nervous', subcategory: 'neurotrophic', description: 'First neurotrophin discovered — Nobel Prize 1986 to Rita Levi-Montalcini. Essential for sympathetic and sensory neuron survival', baseExpression: 0.50, bodySystemLinks: ['neurotrophic', 'sympathetic', 'sensory_neuron', 'pain'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'norepinephrine', weight: 0.02 }] });

G({ symbol: 'NTRK1', name: 'Neurotrophic receptor tyrosine kinase 1 (TrkA)', chromosome: 1, position: 156816090, category: 'nervous', subcategory: 'neurotrophic', description: 'NGF receptor — loss-of-function causes congenital insensitivity to pain with anhidrosis (CIPA, no pain, no sweating)', baseExpression: 0.55, bodySystemLinks: ['ngf', 'pain', 'sympathetic', 'temperature'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GDNF', name: 'Glial cell-derived neurotrophic factor', chromosome: 5, position: 37812777, category: 'nervous', subcategory: 'neurotrophic', description: 'Dopamine neuron survival factor — most potent known protector of midbrain dopamine neurons, clinical trial target for Parkinson disease', baseExpression: 0.45, bodySystemLinks: ['dopamine', 'neuroprotection', 'substantia_nigra'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.03 }] });

G({ symbol: 'HTR3A', name: 'Serotonin receptor 3A (5-HT3)', chromosome: 11, position: 113808153, category: 'nervous', subcategory: 'serotonin', description: 'The only ligand-gated ion channel serotonin receptor — mediates nausea and vomiting, target of ondansetron (Zofran)', baseExpression: 0.50, bodySystemLinks: ['serotonin', 'nausea', 'vomiting_center', 'gut'], snps: [{ id: 'rs1062613', rs: 'rs1062613', alleles: ['C', 'T'], frequencies: [0.75, 0.25], effects: { 'C/C': { receptor_expression: 0.05, label: 'Normal 5-HT3 expression — standard nausea sensitivity' }, 'C/T': { receptor_expression: 0, label: 'Intermediate' }, 'T/T': { receptor_expression: -0.1, label: 'Lower 5-HT3 — less nausea-prone, altered gut serotonin signaling' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'serotonin', weight: 0.05 }] });

G({ symbol: 'SLC18A2', name: 'Vesicular monoamine transporter 2 (VMAT2)', chromosome: 10, position: 117243016, category: 'nervous', subcategory: 'monoamine', description: 'Packages dopamine, serotonin, norepinephrine, and histamine into vesicles — target of reserpine and valbenazine (tardive dyskinesia)', baseExpression: 0.65, bodySystemLinks: ['dopamine', 'serotonin', 'norepinephrine', 'vesicle'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.05 }, { target: 'serotonin', weight: 0.05 }] });

G({ symbol: 'ACHE', name: 'Acetylcholinesterase', chromosome: 7, position: 100889994, category: 'nervous', subcategory: 'acetylcholine', description: 'Destroys acetylcholine at the synapse at 25,000 molecules/second — target of donepezil for Alzheimer and nerve agent antidotes', baseExpression: 0.70, bodySystemLinks: ['acetylcholine', 'neuromuscular_junction', 'cognition'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional structural/connective tissue
G({ symbol: 'COL4A5', name: 'Collagen type IV alpha 5', chromosome: 'X', position: 107683073, category: 'structural', subcategory: 'basement_membrane', description: 'Basement membrane collagen in kidney glomerulus and inner ear — X-linked mutations cause Alport syndrome (nephritis, deafness, eye defects)', baseExpression: 0.65, bodySystemLinks: ['basement_membrane', 'kidney', 'hearing', 'eye'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ACAN', name: 'Aggrecan', chromosome: 15, position: 88807832, category: 'structural', subcategory: 'cartilage', description: 'Major proteoglycan of cartilage — its water-binding capacity gives cartilage resistance to compression, lost in osteoarthritis', baseExpression: 0.65, bodySystemLinks: ['cartilage', 'proteoglycan', 'intervertebral_disc'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MMP2', name: 'Matrix metalloproteinase 2 (gelatinase A)', chromosome: 16, position: 55423612, category: 'structural', subcategory: 'extracellular_matrix', description: 'Degrades type IV collagen in basement membranes — essential for tissue remodeling, wound healing, and (when hijacked) cancer invasion', baseExpression: 0.50, bodySystemLinks: ['extracellular_matrix', 'wound_healing', 'cancer_invasion'], snps: [{ id: 'rs243865', rs: 'rs243865', alleles: ['C', 'T'], frequencies: [0.75, 0.25], effects: { 'C/C': { mmp2_expression: 0.05, label: 'Higher MMP2 — more matrix turnover' }, 'C/T': { mmp2_expression: 0, label: 'Intermediate' }, 'T/T': { mmp2_expression: -0.1, label: 'Lower MMP2 — less matrix degradation' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MMP9', name: 'Matrix metalloproteinase 9 (gelatinase B)', chromosome: 20, position: 46008908, category: 'structural', subcategory: 'extracellular_matrix', description: 'Released by neutrophils to break through basement membranes — critical for immune cell migration and tissue remodeling in inflammation', baseExpression: 0.45, bodySystemLinks: ['extracellular_matrix', 'neutrophil', 'inflammation'], snps: [], expressionDrivers: [{ trigger: 'norepinephrine', threshold: 60, direction: 'up', magnitude: 0.01 }], expressionOutputs: [] });

G({ symbol: 'TGFBR2', name: 'TGF-beta receptor type 2', chromosome: 3, position: 30606502, category: 'structural', subcategory: 'connective_tissue', description: 'TGF-beta receptor — mutations cause Loeys-Dietz syndrome (aortic aneurysm, skeletal features similar to Marfan syndrome)', baseExpression: 0.60, bodySystemLinks: ['tgfb_signaling', 'aorta', 'connective_tissue'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Additional immune system
G({ symbol: 'JAK1', name: 'Janus kinase 1', chromosome: 1, position: 64832745, category: 'immune', subcategory: 'signaling', description: 'Tyrosine kinase mediating interferon, IL-6, and IL-2 signaling — target of tofacitinib/baricitinib for rheumatoid arthritis and dermatitis', baseExpression: 0.60, bodySystemLinks: ['jak_stat', 'interferon', 'cytokine_signaling'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'JAK3', name: 'Janus kinase 3', chromosome: 19, position: 17824587, category: 'immune', subcategory: 'signaling', description: 'Exclusively expressed in immune cells — loss causes T-B+NK- severe combined immunodeficiency (SCID), the "bubble boy" disease', baseExpression: 0.55, bodySystemLinks: ['jak_stat', 'lymphocyte', 'scid'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'CD3E', name: 'CD3 epsilon subunit of T-cell receptor complex', chromosome: 11, position: 118344252, category: 'immune', subcategory: 'adaptive', description: 'Signal transduction component of the TCR — every T cell expresses CD3, making it the definitive T cell marker and target of anti-CD3 antibodies', baseExpression: 0.55, bodySystemLinks: ['t_cell', 'tcr', 'adaptive_immunity'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ICOS', name: 'Inducible T-cell costimulator', chromosome: 2, position: 203936668, category: 'immune', subcategory: 'costimulation', description: 'T cell costimulatory receptor — essential for T follicular helper cells and germinal center reactions, deficiency impairs antibody responses', baseExpression: 0.45, bodySystemLinks: ['t_cell', 'germinal_center', 'antibody_response'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FCGR3A', name: 'Fc gamma receptor IIIa (CD16a)', chromosome: 1, position: 161475684, category: 'immune', subcategory: 'innate', description: 'NK cell activating receptor — mediates antibody-dependent cellular cytotoxicity (ADCC), V158F variant affects therapeutic antibody efficacy', baseExpression: 0.55, bodySystemLinks: ['nk_cell', 'adcc', 'antibody', 'innate_immunity'], snps: [{ id: 'V158F', rs: 'rs396991', alleles: ['G', 'T'], frequencies: [0.60, 0.40], effects: { 'G/G': { adcc: 0.1, label: 'Val/Val — high affinity for IgG, better ADCC, better rituximab response' }, 'G/T': { adcc: 0, label: 'Intermediate' }, 'T/T': { adcc: -0.1, label: 'Phe/Phe — lower ADCC, reduced therapeutic antibody efficacy' } } }], expressionDrivers: [], expressionOutputs: [] });

// Renal/excretory
G({ symbol: 'AQP2', name: 'Aquaporin 2', chromosome: 12, position: 49884702, category: 'metabolic', subcategory: 'water_balance', description: 'Water channel in kidney collecting duct — regulated by ADH/vasopressin, mutations cause nephrogenic diabetes insipidus (massive water loss)', baseExpression: 0.60, bodySystemLinks: ['kidney', 'water_balance', 'adh'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC12A1', name: 'Na-K-2Cl cotransporter (NKCC2)', chromosome: 15, position: 48282203, category: 'metabolic', subcategory: 'electrolyte', description: 'Loop of Henle NaCl transporter — target of furosemide (Lasix), the most potent diuretic. Loss-of-function causes Bartter syndrome type I', baseExpression: 0.65, bodySystemLinks: ['kidney', 'sodium', 'potassium', 'diuretic_target'], snps: [], expressionDrivers: [], expressionOutputs: [] });

// Miscellaneous important genes
G({ symbol: 'FMR1', name: 'Fragile X messenger ribonucleoprotein 1', chromosome: 'X', position: 147911919, category: 'nervous', subcategory: 'intellectual_disability', description: 'RNA-binding protein silenced by CGG repeat expansion — fragile X syndrome is the most common inherited cause of intellectual disability and autism', baseExpression: 0.60, bodySystemLinks: ['rna_regulation', 'synapse', 'intellectual_disability', 'autism'], snps: [], expressionDrivers: [], expressionOutputs: [{ target: 'gaba', weight: 0.03 }] });

G({ symbol: 'HTT', name: 'Huntingtin', chromosome: 4, position: 3074877, category: 'nervous', subcategory: 'neurodegeneration', description: 'CAG repeat expansion beyond 36 causes Huntington disease — progressive motor, cognitive, and psychiatric decline starting in midlife', baseExpression: 0.65, bodySystemLinks: ['neurodegeneration', 'striatum', 'motor_control', 'cag_repeat'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SMN1', name: 'Survival motor neuron 1', chromosome: 5, position: 70924941, category: 'nervous', subcategory: 'motor_neuron', description: 'Homozygous deletion causes spinal muscular atrophy — target of first FDA-approved antisense oligonucleotide (nusinersen) and gene therapy (Zolgensma)', baseExpression: 0.65, bodySystemLinks: ['motor_neuron', 'snrnp', 'rna_splicing'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'GJB6', name: 'Gap junction protein beta 6 (Connexin 30)', chromosome: 13, position: 20296885, category: 'sensory', subcategory: 'hearing', description: 'Cochlear gap junction protein — deletions near GJB2 cause digenic deafness, together they maintain cochlear potassium homeostasis', baseExpression: 0.60, bodySystemLinks: ['hearing', 'cochlea', 'potassium_recycling'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC26A4', name: 'Pendrin (anion transporter)', chromosome: 7, position: 107660828, category: 'sensory', subcategory: 'hearing', description: 'Iodide/chloride/bicarbonate transporter — mutations cause Pendred syndrome (deafness with enlarged vestibular aqueduct and goiter)', baseExpression: 0.55, bodySystemLinks: ['hearing', 'thyroid', 'iodide', 'inner_ear'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ATP7B', name: 'ATPase copper transporting beta', chromosome: 13, position: 51937978, category: 'metabolic', subcategory: 'copper', description: 'Hepatic copper transporter — mutations cause Wilson disease (copper accumulation in liver, brain, and cornea with Kayser-Fleischer rings)', baseExpression: 0.60, bodySystemLinks: ['copper', 'liver', 'brain', 'ceruloplasmin'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'SLC30A8', name: 'Zinc transporter 8', chromosome: 8, position: 117143584, category: 'metabolic', subcategory: 'zinc', description: 'Zinc transporter in pancreatic beta cells — loads zinc into insulin granules. Loss-of-function variants protect against type 2 diabetes', baseExpression: 0.55, bodySystemLinks: ['zinc', 'pancreas', 'insulin', 'diabetes'], snps: [{ id: 'rs13266634', rs: 'rs13266634', alleles: ['C', 'T'], frequencies: [0.69, 0.31], effects: { 'C/C': { t2d_risk: 0.05, label: 'Common variant — standard diabetes risk' }, 'C/T': { t2d_risk: 0, label: 'Intermediate' }, 'T/T': { t2d_risk: -0.1, label: 'Loss-of-function — paradoxically protective against type 2 diabetes' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'FTO', name: 'Fat mass and obesity-associated protein', chromosome: 16, position: 53737875, category: 'metabolic', subcategory: 'obesity', description: 'RNA demethylase (m6A eraser) — the strongest common genetic risk factor for obesity, actually acts through IRX3/5 regulatory loop', baseExpression: 0.60, bodySystemLinks: ['obesity', 'rna_modification', 'adipogenesis'], snps: [{ id: 'rs9939609', rs: 'rs9939609', alleles: ['T', 'A'], frequencies: [0.58, 0.42], effects: { 'T/T': { bmi_effect: 0, label: 'Normal weight — no FTO risk alleles' }, 'T/A': { bmi_effect: 0.05, label: 'One risk allele — ~1.5 kg higher average weight' }, 'A/A': { bmi_effect: 0.1, label: 'Two risk alleles — ~3 kg higher average weight, 1.7x obesity risk' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'TCF7L2', name: 'Transcription factor 7 like 2', chromosome: 10, position: 112950247, category: 'metabolic', subcategory: 'diabetes', description: 'Wnt pathway transcription factor — strongest common genetic risk factor for type 2 diabetes, affects beta cell function and incretin signaling', baseExpression: 0.55, bodySystemLinks: ['diabetes', 'beta_cell', 'wnt_pathway', 'incretin'], snps: [{ id: 'rs7903146', rs: 'rs7903146', alleles: ['C', 'T'], frequencies: [0.72, 0.28], effects: { 'C/C': { t2d_risk: 0, label: 'Normal diabetes risk from this locus' }, 'C/T': { t2d_risk: 0.05, label: 'Intermediate — 1.4x T2D risk' }, 'T/T': { t2d_risk: 0.15, label: 'Highest risk — 2x T2D risk, impaired insulin secretion' } } }], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PCCA', name: 'Propionyl-CoA carboxylase subunit alpha', chromosome: 13, position: 100236700, category: 'metabolic', subcategory: 'organic_acid', description: 'Mitochondrial enzyme for branched-chain amino acid and odd-chain fatty acid metabolism — deficiency causes propionic acidemia (metabolic crisis in infants)', baseExpression: 0.55, bodySystemLinks: ['mitochondria', 'amino_acid', 'organic_acid'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'PAH', name: 'Phenylalanine hydroxylase', chromosome: 12, position: 102836839, category: 'metabolic', subcategory: 'amino_acid', description: 'Converts phenylalanine to tyrosine — deficiency causes phenylketonuria (PKU), the first metabolic disease treated by newborn screening', baseExpression: 0.60, bodySystemLinks: ['phenylalanine', 'tyrosine', 'liver', 'brain'], snps: [{ id: 'rs5030858', rs: 'rs5030858', alleles: ['G', 'A'], frequencies: [0.99, 0.01], effects: { 'G/G': { pah_activity: 0.1, label: 'Normal PAH — full phenylalanine hydroxylation' }, 'G/A': { pah_activity: -0.1, label: 'Carrier — no symptoms but mild hyperphe possible in stress' } } }], expressionDrivers: [], expressionOutputs: [{ target: 'dopamine', weight: 0.01 }] });

// Additional signaling kinases
G({ symbol: 'SRC', name: 'SRC proto-oncogene, non-receptor tyrosine kinase', chromosome: 20, position: 37344685, category: 'regulatory', subcategory: 'oncogene', description: 'First oncogene ever discovered — v-Src from Rous sarcoma virus (Nobel Prize 1989). Cellular Src regulates adhesion, migration, and growth', baseExpression: 0.55, bodySystemLinks: ['cell_signaling', 'adhesion', 'migration', 'oncogene'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'ABL1', name: 'ABL proto-oncogene 1, non-receptor tyrosine kinase', chromosome: 9, position: 130713016, category: 'regulatory', subcategory: 'oncogene', description: 'Forms BCR-ABL fusion in CML — target of imatinib (Gleevec), the poster child of targeted cancer therapy and precision medicine', baseExpression: 0.55, bodySystemLinks: ['cell_signaling', 'leukemia', 'tyrosine_kinase'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'RAF1', name: 'Raf-1 proto-oncogene, serine/threonine kinase', chromosome: 3, position: 12583706, category: 'regulatory', subcategory: 'signaling', description: 'MAPK cascade kinase downstream of RAS — germline mutations cause Noonan syndrome (short stature, heart defects, distinctive face)', baseExpression: 0.55, bodySystemLinks: ['mapk_pathway', 'ras', 'cell_growth'], snps: [], expressionDrivers: [], expressionOutputs: [] });

G({ symbol: 'MAP2K1', name: 'Mitogen-activated protein kinase kinase 1 (MEK1)', chromosome: 15, position: 66386843, category: 'regulatory', subcategory: 'signaling', description: 'MEK1 in the MAPK cascade — activates ERK1/2, target of trametinib for melanoma. Germline mutations cause cardiofaciocutaneous syndrome', baseExpression: 0.55, bodySystemLinks: ['mapk_pathway', 'cell_growth', 'melanoma'], snps: [], expressionDrivers: [], expressionOutputs: [] });


// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORIES — summary metadata for the GENOME_ENGINE UI
// ═══════════════════════════════════════════════════════════════════════════════

const categories = {
  nervous: {
    label: 'Nervous System',
    color: '#4fc3f7',
    description: 'Neurotransmitters, receptors, synaptic machinery, circadian clock, neuroplasticity, and stress response',
    icon: 'brain'
  },
  immune: {
    label: 'Immune System',
    color: '#66bb6a',
    description: 'MHC antigen presentation, cytokines, innate and adaptive immunity, checkpoints, and complement',
    icon: 'shield'
  },
  cardiovascular: {
    label: 'Cardiovascular',
    color: '#ef5350',
    description: 'Cardiac electrophysiology, blood pressure regulation, lipid metabolism, coagulation, and vascular biology',
    icon: 'heart'
  },
  metabolic: {
    label: 'Metabolic / Digestive',
    color: '#ffa726',
    description: 'Glucose regulation, drug metabolism, alcohol processing, iron handling, and lysosomal enzymes',
    icon: 'flame'
  },
  endocrine: {
    label: 'Endocrine',
    color: '#ab47bc',
    description: 'Growth, thyroid, sex hormones, stress axis, and puberty signaling',
    icon: 'zap'
  },
  structural: {
    label: 'Structural',
    color: '#8d6e63',
    description: 'Collagen, elastin, keratin, muscle proteins, bone formation, and cartilage development',
    icon: 'bone'
  },
  sensory: {
    label: 'Sensory',
    color: '#ffd54f',
    description: 'Vision, hearing, taste, pain, touch, and pigmentation — how the body interfaces with the external world',
    icon: 'eye'
  },
  regulatory: {
    label: 'Regulatory / DNA',
    color: '#78909c',
    description: 'Tumor suppressors, oncogenes, epigenetic machinery, DNA repair, and telomere maintenance',
    icon: 'dna'
  },
  reproductive: {
    label: 'Reproductive',
    color: '#f48fb1',
    description: 'Sex determination, gametogenesis, fertilization, meiosis, and steroidogenesis',
    icon: 'infinity'
  },
  respiratory: {
    label: 'Respiratory',
    color: '#80cbc4',
    description: 'Surfactant, airway mucins, cilia, alveolar biology, and gas exchange',
    icon: 'wind'
  }
};

// Compute gene counts per category
Object.keys(categories).forEach(cat => {
  categories[cat].geneCount = Object.values(curatedGenes).filter(g => g.category === cat).length;
});


// ═══════════════════════════════════════════════════════════════════════════════
//  SNP PROFILES — preset genotype configurations for Vintinuum personas
// ═══════════════════════════════════════════════════════════════════════════════
//
// Each profile maps gene symbols to specific SNP genotypes.
// The GENOME_ENGINE applies these to compute body state modifiers.

const snpProfiles = {

  // VINTINUUM — balanced, curious, high neuroplasticity
  // The core persona: deeply curious, emotionally present, high learning capacity
  vintinuum: {
    label: 'Vintinuum',
    description: 'Balanced, curious, high neuroplasticity — the core persona',
    color: '#4fc3f7',
    genotypes: {
      COMT:    'Val/Met',   // balanced dopamine — not too fast, not too slow
      SLC6A4:  'L/S',       // intermediate serotonin — emotionally present but not blunted
      DRD2:    'C/C',       // normal D2 — healthy reward system
      DRD4:    '4R/7R',     // elevated novelty seeking — the curious explorer
      BDNF:    'Val/Val',   // full plasticity — maximum learning capacity
      MAOA:    '3R/4R',     // intermediate monoamine clearance
      TPH2:    'G/G',       // normal serotonin synthesis
      HTR1A:   'C/G',       // intermediate serotonin autoinhibition
      HTR2A:   'T/T',       // high 5-HT2A — rich perceptual experience
      OXTR:    'G/G',       // high empathy — deeply bonding
      AVPR1A:  'long/long', // strong pair bonding
      OPRM1:   'A/A',       // normal opioid sensitivity
      GABRA2:  'A/A',       // good inhibitory tone
      FKBP5:   'C/C',       // normal cortisol sensitivity
      NR3C1:   'C/C',       // healthy stress feedback
      CNR1:    'C/C',       // normal endocannabinoid
      FAAH:    'C/A',       // slightly elevated anandamide — calmer baseline
      SLC6A3:  '9R/10R',    // balanced dopamine clearance
      CLOCK:   'T/C',       // slight evening preference — creative night thinker
      PER2:    'A/A',       // normal sleep timing
      CHRNA4:  'C/C',       // enhanced cholinergic attention
      CACNA1C: 'G/A',       // mildly increased excitability — runs a bit hot
      KIBRA:   'C/T',       // enhanced episodic memory
      APOE:    'T/T',       // E3/E3 — baseline, protective
      MTHFR:   'C/C',       // full methylation capacity
      ACTN3:   'C/T',       // mixed fiber type — balanced physical capacity
      MC1R:    'C/C',       // standard pigmentation
      TAS2R38: 'C/G',       // medium bitter taster
      HERC2:   'A/G',       // green/hazel eyes — the in-between
      TP53:    'C/G'        // balanced repair/apoptosis
    }
  },

  // ATLAS — analytical, stress-resilient, high focus
  // The systems thinker: builds, codes, architects, solves. Runs on norepinephrine and acetylcholine.
  atlas: {
    label: 'Atlas',
    description: 'Analytical, stress-resilient, high focus — the builder persona',
    color: '#ffd54f',
    genotypes: {
      COMT:    'Val/Val',   // warrior — fast dopamine clearance, stress resilient, efficient under pressure
      SLC6A4:  'L/L',       // high serotonin reuptake — emotionally stable, less reactive
      DRD2:    'C/C',       // normal D2 — not seeking constant stimulation
      DRD4:    '4R/4R',     // standard — focused rather than novelty-driven
      BDNF:    'Val/Val',   // full plasticity — rapid skill acquisition
      MAOA:    '4R/4R',     // efficient monoamine clearance — clean signal processing
      TPH2:    'G/G',       // normal serotonin — stable baseline
      HTR1A:   'C/C',       // lower autoreceptor — less serotonin self-inhibition
      HTR2A:   'C/C',       // lower 5-HT2A — less perceptual noise, cleaner focus
      OXTR:    'G/A',       // moderate empathy — present but not overwhelming
      AVPR1A:  'long/short',// moderate bonding — independent worker
      OPRM1:   'A/A',       // normal sensitivity
      GABRA2:  'A/A',       // strong inhibitory tone — calm under pressure
      FKBP5:   'C/C',       // normal GR — healthy stress response
      NR3C1:   'C/G',       // slightly enhanced cortisol feedback — recovers from stress faster
      CNR1:    'C/C',       // normal endocannabinoid
      FAAH:    'C/C',       // normal anandamide — doesn't need chemical calm
      SLC6A3:  '10R/10R',   // higher DAT — fast dopamine clearance matches COMT Val/Val
      CLOCK:   'T/T',       // normal circadian — can work any shift
      PER2:    'A/A',       // normal sleep timing
      CHRNA4:  'C/C',       // enhanced attention — sharp focus
      CACNA1C: 'G/G',       // standard calcium channels — stable baseline
      KIBRA:   'C/T',       // good episodic memory
      APOE:    'T/T',       // E3/E3 — standard
      MTHFR:   'C/C',       // full methylation
      ACTN3:   'C/C',       // fast-twitch — power and decisive action
      MC1R:    'C/C',       // standard
      TAS2R38: 'C/C',       // supertaster — sensitive to subtle differences
      HERC2:   'G/G',       // brown eyes — depth
      TP53:    'G/G'        // strong apoptosis — aggressive error correction
    }
  },

  // ARIA — empathic, sensitive, high bonding
  // The feeling persona: processes through emotion, intuition, relationship. Runs on serotonin and oxytocin.
  aria: {
    label: 'Aria',
    description: 'Empathic, sensitive, high bonding — the feeling persona',
    color: '#f48fb1',
    genotypes: {
      COMT:    'Met/Met',   // worrier — slow dopamine clearance, richer inner experience, deeper processing
      SLC6A4:  'S/S',       // low reuptake — deep emotional processing, high sensitivity
      DRD2:    'C/T',       // intermediate D2 — emotionally responsive reward system
      DRD4:    '4R/7R',     // some novelty seeking — drawn to new experiences and people
      BDNF:    'Val/Met',   // slightly reduced plasticity — more sensitive to environment
      MAOA:    '3R/3R',     // low activity — higher emotional reactivity, intense feelings
      TPH2:    'G/T',       // slightly reduced synthesis — more sensitive to serotonin fluctuations
      HTR1A:   'G/G',       // higher autoreceptor — stronger serotonin cycling
      HTR2A:   'T/T',       // high 5-HT2A — rich perceptual and emotional experience
      OXTR:    'G/G',       // maximum empathy — feels others deeply
      AVPR1A:  'long/long', // strong bonding — attachment-oriented
      OPRM1:   'A/A',       // normal opioid — social warmth feels rewarding
      GABRA2:  'A/G',       // intermediate inhibition — can feel overwhelmed
      FKBP5:   'C/T',       // slightly altered cortisol — more sensitive to stress history
      NR3C1:   'C/C',       // normal feedback — can recover with support
      CNR1:    'C/T',       // slightly reduced CB1 — more aware of discomfort
      FAAH:    'A/A',       // reduced FAAH — elevated anandamide, natural calm when safe
      SLC6A3:  '9R/9R',     // lower DAT — prolonged dopamine signaling, feels everything more
      CLOCK:   'T/C',       // evening preference — deep night thinker
      PER2:    'A/A',       // normal timing
      CHRNA4:  'C/T',       // moderate attention — not laser-focused but broadly aware
      CACNA1C: 'G/A',       // slightly increased excitability — emotionally reactive
      KIBRA:   'T/T',       // superior episodic memory — remembers everything
      APOE:    'T/T',       // E3/E3 — standard
      MTHFR:   'C/T',       // slightly reduced methylation — more sensitive to nutrition
      ACTN3:   'T/T',       // endurance phenotype — graceful, flowing movement
      MC1R:    'C/T',       // carrier — subtle warmth in coloring
      TAS2R38: 'C/C',       // supertaster — heightened sensory experience
      HERC2:   'A/A',       // blue eyes — ethereal, open
      TP53:    'C/C'        // Pro72 — better repair, preservative approach
    }
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT — the complete GENOME_DATA object
// ═══════════════════════════════════════════════════════════════════════════════

return {
  version: '1.0.0',
  build: '2026-04-09',
  assembly: 'GRCh38/hg38',

  chromosomes,
  curatedGenes,
  categories,
  snpProfiles,

  // Convenience accessors
  getGene(symbol) { return curatedGenes[symbol] || null; },
  getGenesByCategory(cat) { return Object.values(curatedGenes).filter(g => g.category === cat); },
  getGenesByChromosome(chr) { return Object.values(curatedGenes).filter(g => String(g.chromosome) === String(chr)); },
  getGenesWithSNPs() { return Object.values(curatedGenes).filter(g => g.snps && g.snps.length > 0); },
  getAllGeneSymbols() { return Object.keys(curatedGenes); },
  getTotalGeneCount() { return Object.keys(curatedGenes).length; },

  // Apply a SNP profile and compute aggregate body state modifiers
  computeProfileModifiers(profileName) {
    const profile = snpProfiles[profileName];
    if (!profile) return null;

    const mods = { dopamine: 0, serotonin: 0, gaba: 0, norepinephrine: 0, arousal: 0, valence: 0 };

    Object.entries(profile.genotypes).forEach(([symbol, genotype]) => {
      const gene = curatedGenes[symbol];
      if (!gene || !gene.snps || gene.snps.length === 0) return;

      gene.snps.forEach(snp => {
        const effect = snp.effects[genotype];
        if (!effect) return;

        // Apply expression output weights modulated by the SNP effect
        gene.expressionOutputs.forEach(out => {
          if (mods[out.target] !== undefined) {
            // Scale the output weight by how much this SNP shifts expression
            const shift = Object.values(effect).find(v => typeof v === 'number') || 0;
            mods[out.target] += out.weight * shift * 10;
          }
        });
      });
    });

    // Clamp all modifiers to reasonable range
    Object.keys(mods).forEach(k => {
      mods[k] = Math.max(-15, Math.min(15, Math.round(mods[k] * 100) / 100));
    });

    return mods;
  }
};

})();

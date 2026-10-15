import { z } from 'zod';
export const brandImageSchema=z.string().max(350000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).nullable();
export const brandingSchema=z.object({logoData:brandImageSchema,symbolData:brandImageSchema,headerWidth:z.number().int().min(100).max(280).default(180),revision:z.number().int().min(0)}).strict();
export type Branding=z.infer<typeof brandingSchema>;
export const emptyBranding:Branding={logoData:null,symbolData:null,headerWidth:180,revision:0};

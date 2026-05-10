import guard1 from "@/assets/avatars/guard1.png";
import guard2 from "@/assets/avatars/guard2.png";
import guard3 from "@/assets/avatars/guard3.png";
import guard4 from "@/assets/avatars/guard4.png";
import doorImg from "@/assets/incidents/door.png";
import packageImg from "@/assets/incidents/package.png";
import logoImg from "@/assets/logo.png";

export const guardAvatars: string[] = [guard1, guard2, guard3, guard4];
export const incidentImages: Record<string, string> = {
  door: doorImg,
  package: packageImg,
};
export const brandLogo = logoImg;

export function avatarFor(idx: number): string {
  return guardAvatars[idx % guardAvatars.length];
}

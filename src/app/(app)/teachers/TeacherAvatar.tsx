import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../_components/Icon";

export const teacherDefaultAvatar = (gender: "MALE" | "FEMALE" | null | undefined) =>
  gender === "FEMALE" ? "/avatars/teacher-female.webp" : "/avatars/teacher-male.webp";

export default function TeacherAvatar({
  imageUrl,
  gender,
  size,
  iconSize,
  className,
  style,
}: {
  imageUrl: string | null;
  gender: "MALE" | "FEMALE" | null | undefined;
  size: number;
  iconSize: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full", className)} style={{ width: size, height: size, ...style }}>
      {!imageUrl && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon name="user" style={{ width: iconSize, height: iconSize }} />
        </span>
      )}
      <span
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl || teacherDefaultAvatar(gender)}")` }}
      />
    </span>
  );
}

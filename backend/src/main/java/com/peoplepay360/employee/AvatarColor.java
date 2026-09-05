package com.peoplepay360.employee;

public final class AvatarColor {
    private AvatarColor() {}
    public static String forKey(String key) {
        int hash = 0;
        for (char c : key.toCharArray()) hash = (hash * 31 + c) & 0x7fffffff;
        int hue = hash % 360;
        return "hsl(" + hue + ", 65%, 55%)";
    }
}

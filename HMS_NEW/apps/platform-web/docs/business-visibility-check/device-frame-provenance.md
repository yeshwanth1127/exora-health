# iPhone frame source

The phone uses the iPhone 15 Pro Natural Titanium PNG from [Mockify](https://github.com/Mecury-Labs/mockify), whose README identifies its frames as Apple Design Resources assets. The original downloaded PNGs are preserved unchanged:

- `public/assets/business-visibility/iphone-15-pro-natural-titanium.png` — 1419 × 2796.
- `public/assets/business-visibility/ios-status-bar-black.png` — 1608 × 248.

Source files:
- https://github.com/Mecury-Labs/mockify/blob/main/packages/mockify-react/assets/devices/iPhone%2015%20Pro%20-%20Natural%20Titanium.png
- https://github.com/Mecury-Labs/mockify/blob/main/packages/mockify-react/assets/status-bar/iPhone%2016%20Pro%20and%2016%20Max%20Status%20Bar%20Black.png
- Screen placement fractions follow `app/components/devices/iphone-15-pro.tsx` in that repository. No third-party runtime was installed or executed.

The clinic listing inside the screen is an illustrative example. A CSS mask shows approximately the upper 60% of the device and fades it into the overlapping headline. The search retains the local Arc combobox; the requested larger size changes its height to 64px desktop and 60px narrow screens.

# Desktop Mode MCQ Option Alignment Fix

## Goal
Desktop mode मध्ये चारही MCQ options समान size आणि नीट aligned 2×2 grid मध्ये दिसतील.

## Changes
- Quiz MCQ options grid ला स्वतंत्र class देऊ, जेणेकरून desktop चे global grid-column rules त्यावर लागू होणार नाहीत.
- Mobile आणि desktop दोन्हीवर MCQ layout 2 columns × 2 rows ठेवू.
- सर्व option buttons ची समान minimum height, width आणि centered content कायम ठेवू; percentage/fraction सारख्या मोठ्या answers मुळे alignment बदलणार नाही.
- इतर learning/setup grids चे सध्याचे desktop 3/4-column layout बदलणार नाही.

## Verification
- Desktop mode मध्ये normal number, percentage/fraction आणि trigonometry MCQ तपासू.
- चारही options समान 2×2 positions मध्ये आणि frame बाहेर न जाता दिसतात हे verify करू.
- Mobile MCQ layout unchanged आहे हे तपासू.

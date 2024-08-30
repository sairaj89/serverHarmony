const express = require('express');
const cors = require('cors');
const tinycolor = require('tinycolor2');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedDomains = ['https://harmonyc.netlify.app'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedDomains.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

const COLORMIND_API_URL = 'http://colormind.io/api/';
const MAX_ATTEMPTS = 7;

const getUniqueColors = (colors) => {
  const uniqueColors = [];
  const seen = new Set();

  for (let color of colors) {
    const hex = tinycolor({ r: color[0], g: color[1], b: color[2] }).toHexString().toUpperCase();
    if (!seen.has(hex)) {
      seen.add(hex);
      uniqueColors.push(color);
    }
  }

  return uniqueColors;
};

const getSuitableBackgroundColor = (colors) => {
  let bestColor = colors[0];
  let bestContrast = 0;

  for (let i = 0; i < colors.length; i++) {
    const color = tinycolor({ r: colors[i][0], g: colors[i][1], b: colors[i][2] });
    const contrast = tinycolor.readability(color, '#FFFFFF');

    if (contrast > bestContrast) {
      bestContrast = contrast;
      bestColor = colors[i];
    }
  }

  return bestColor;
};

const getLighterColors = (colors) => {
  return colors.filter(color => {
    const tc = tinycolor({ r: color[0], g: color[1], b: color[2] });
    return tc.isLight();
  });
};

const hasDuplicateColors = (colorArray) => {
  const hexColors = colorArray.map(color => tinycolor({ r: color[0], g: color[1], b: color[2] }).toHexString().toUpperCase());
  return new Set(hexColors).size !== hexColors.length;
};

const fetchColorsWithRetry = async (attempts = MAX_ATTEMPTS) => {
  for (let i = 0; i < attempts; i++) {
    const response = await axios.post(COLORMIND_API_URL, { model: 'default' });

    let colors = response.data.result;
    colors = getUniqueColors(colors);

    const mainColor = getSuitableBackgroundColor(colors);
    const lighterColors = getLighterColors(colors);

    if (lighterColors.length >= 3 && !hasDuplicateColors([mainColor, lighterColors[0], lighterColors[1], lighterColors[2]])) {
      return {
        mainColor: mainColor,
        secondaryColor: lighterColors[0],
        accentColor1: lighterColors[1],
        accentColor2: lighterColors[2],
      };
    } else if (lighterColors.length >= 2 && !hasDuplicateColors([mainColor, lighterColors[0], lighterColors[1]])) {
      return {
        mainColor: mainColor,
        secondaryColor: lighterColors[0],
        accentColor1: lighterColors[1],
      };
    } else if (lighterColors.length >= 1 && !hasDuplicateColors([mainColor, lighterColors[0]])) {
      return {
        mainColor: mainColor,
        secondaryColor: lighterColors[0],
      };
    }
  }

  throw new Error('Not enough unique and lighter colors fetched from Colormind API.');
};

app.get('/api/colors', async (req, res) => {
  try {
    const colorPalette = await fetchColorsWithRetry();
    res.json(colorPalette);
  } catch (error) {
    console.error('Error fetching colors from Colormind API:', error);
    res.status(500).send('Error fetching colors');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

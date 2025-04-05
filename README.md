
# NASA POWER API DATA 

Columns in the Data

1. ALLSKY_KT:
    This column represents the all-sky (actual) shortwave broadband transmissivity, which indicates the amount of solar radiation that reaches the surface of the Earth after being transmitted through the atmosphere. It is expressed as a dimensionless ratio of the solar radiation incident on the surface to the radiation that would reach the surface if there were no atmospheric effects.

2. ALLSKY_SFC_LW_DWN:
    This column provides the downward longwave radiation at the surface (in W/m²). It represents the amount of infrared radiation emitted by the atmosphere and clouds that reaches the surface of the Earth.

3. ALLSKY_SFC_SW_DNI:
    This column represents the Direct Normal Irradiance (DNI) of shortwave solar radiation at the surface (in W/m²). DNI measures the amount of solar radiation received per unit area from a direction normal to the surface (i.e., directly overhead).

4. ALLSKY_SFC_SW_DWN:
    This column provides the downward shortwave radiation at the surface (in W/m²). It represents the total amount of solar radiation, including both direct and diffuse solar radiation, that reaches the surface.

5. CLRSKY_SFC_PAR_TOT:
    This column represents the total Photosynthetically Active Radiation (PAR) at the surface under clear-sky conditions (in µmol/m²/s). PAR is the portion of the solar radiation spectrum that is usable by plants for photosynthesis.

6. CLRSKY_SFC_SW_DWN:
    This column represents the downward shortwave radiation at the surface under clear-sky conditions (in W/m²). It indicates the amount of solar radiation reaching the Earth's surface without the interference of clouds and other atmospheric conditions.

## Features used to train model 
1. ALLSKY_KT
2. ALLSKY_SFC_LW_DWN
3. Latitude
4. Longitude
5. Month_sin
6. Month_cos

Target - ALLSKY_SFC_SW_DWN

## Year-Month Format Breakdown (e.g., 201001)
The date format in the data is represented as a six-digit number, where:

The first four digits represent the year.
The last two digits represent the month.

For example, a value of 201901 corresponds to:
Year: 2019
Month: January

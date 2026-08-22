#!/usr/bin/env bash
# Converged installer.
#
#   curl -sfL https://converged.4ir.club | sudo sh -
#
# Self-contained on purpose: the ptah chart travels inside this file as a
# base64 tarball, so the installer is one artefact to serve and one to audit.
# Regenerate with `bun run core/tools/install/build.ts` — editing the payload
# by hand is how the chart and the script drift apart.
set -euo pipefail

CHART_B64='H4sIAAAAAAAAA+w9a3PcNpL5zF+BGmUrj9NQkm1JydibKllWHO3ask5SksqlUh4MiZlhRBI0QWo88abqfsT9wvsl1w+Ar5nRayUlqTNraz0igUaj0W80EH/jk3t/NuHZ3d6mf+Hp/rvk987mk0efiO37R+2TT0pTyFyIhxjqz/j4G/tTmRf+XCbxfY2Bi7rz5MnK9d/Z3eqs/+7u7uNPxOZ9IdR8/p+vv8yiH1RuIp0OxMUjL5WJGoiskFMvVCbIo6ygT//yhDibKqFTJYBgRRQI4Bo1lkEh9FhIsa/TC5VPVChClcV6nqi0GIj9kxdmXZw839tfFwV0J8BC6EzlstD5upBpCJ1NlE5iJY5jWYx1ngg9+lUFhS8OAORczHR+HmsZiv/97/8RZbQuEoA5UlOV6GK6DuDG5a9Rui4CGDJKZFrC51wZTT+yXAfKGJ0b6h4ZEeRKFoDnaE7oCFmIvMSeSoxznQC8YgrvKmQQRcTd6LhEYhgRy7nKAYJOCy2iYl2kukBwxRTBkzh5xTwDQsosi6NAYjfvwpF509/yNz34VBG+R6963rmaw2RDMxA/B46e6w1qnZcjlaeqUOYX747W398IYMD7NQK30P+7u9sf9f9DPHb98f/uzQZcrv+34FtH/8OrrZ2P+v8hnjVQ67lS4jxKQ1CXVrX53pq3JkStBEkDjqRRItA5KLZclwVoL1C6MpiqdbAJOpcT+FFGpDAT44vnWhdGyBhshk/QTq0GFdBEaFBvMBpaj0SHZawMdURlP471DLVshCpWFDpjE5NZZBjYmUplWsAPtklRgcYJWgWxLsOq7QD0sxF6ljoMhQH9HNJQoU5klBqe69BkKhiifQhVHI1Q46p4LmKtjfLJ9GUaVPmcKYTtyCaw4bqQcRRWBg2ghaXV++mEEMhpfhHaizeZSveOD2GiZQx0UkCKYqYRYbBTMFk0ICngSWZnpgEYvrDfwsjICSyXxSgHiIBMAHRNwC4F2towMtFo/WbTKJgipggGzFWu4xg6AD1g2v1+32uaf/it3hcqxb+Mf/6V8SO9cbHlIWuAKQdB0ckJ2NUyD9QLNY7SiOxaogoJk5cDsJzWfbDENz4aWIDiIXHx+wT4JmP/Al8LYQKNdnI/BugqtxAMNhWCx3UsSK+yuMxl3BiB3uIqlLHM6/f8eqrz4ojgiZ/xyy/w2lphO0TfYnyxJeNsKrfoJfRU+YWCsYu8VO4Vs0/7XTnKLT0sPG6JtB+ID7+7ZiAhiawbaOaAHx6fdj6AlJHXwO5P4zU4MeADFFFzGIJsydp8VoDA532/diD6GaCO0+yX6XkKDNEfRypG16MxQffk6l0Z5UiRnwGVcRSDoNNCZcC0v3Qar0LWfsPeix8c3qYAnp4s+azSEoT550SnGhzAMi7ADyRR7w4vasxuNIxdtnukpgxDkhgZH7Pg7rPc1mM6djxmMi0wxgLav4KXeyyL6UD4jL+fdbo6kEeOKLcBmi50dmCdSje3AWsWOjuwr9ki3AaoNSYvookyxQLgvckiAUB5qeUgnWrzKWYATM8gSoBxkuz+lGdFlLtQnm55WsqzTfZaeZpm45byhC8fdecd6E5rnW6kMZ0jc1OVCe7RKIZhV/YbaR2D9/HnVYJNW37phJdowW7fSv4xIFfhAsxFYiwClZ2+lbI6XQCHM5uQSK4Gl0RBrpFeUaCWaMBvbw8UXEBoCv78X1D9FeTW34ny4wihpfos9I7iK1zDjwruL6TgLNFPo99u7k/a0G91P5nncr7kK4SZydJuVyHrbO7DDPln0uMnSobzBTa+jsLNWz0rlxMF/1buZqtjBY7Z6FYAuet3+j4dzXvO//gbwF4og+r+ksA3zv9ubW4+2fyY/32Ip7n+b6cqBj1t/CK70zzwFft/j7e3nnTW/9Hjne2P+d+HeD582PjSozhP6DSe+553NlW5wgRnql1iE3O2+LaVCAX7GYW8pbcqHSr02JN1Ehk9kmrLTwUafoBKphRwMQVXuEqTipdaVGwJbTBTith5Cjy0KgkqZlEBQxe0sSd544337mQQqKwwYoZ/IGJuCw2cFTR+Zl3o3MvVuDTKtgIwnJGdygtlAWAe/MuN33/3vA8f+iJEt1WJHrmgqOR7og/f7CdZxoXweS8dySn8H2RcKs6dvAG0cyTWv9CEpoHYeUw/o+S0HI+j96LXr4GB406/Fwcdl3HcHvhT/FMM/n59DFzPaEwJYfSCLBT/RIFFNoo7u3btt9fCPzZ1d0pRj0Xvb6b/N9PrQONxb0KTDn2AdZEhcc+AE3602I7fPjNki6sN3CqLRSl5t6uMGw3QIEp97wUTkTLt2CFnZOuO6+DH8UYE8OgQtGWCUlDIOBb9VDxLzTdDkSoVoux4lsONKmgbAGAaOWcxQayKKb2dQfRnuWxhvat5LeG0JiF5Um65q17X4CibLazhOyD2wzVAxHIEK84QkCK+mW6QKEKQ82Fh/Zvsyb9tCAlrnyvaBBG9/+iJ3tvepYwBg0E47tdOK8ab7HnBqFEaxGXYllV/eR9avzTgfm32XNq+2sXH5jyDvWonH/B8V+piRddEpuAthv3RvD3YKecAlncKdJLplIopnBK7YkEMgA2g2avGwjwEra7Ciia5F4A2Tymx2GvqIsd37WbsDqsF7v+8jXStF/0vVkFKm0qtpaIc0J790bseiCUa6Y+25bd5mv5fXblzt6UAV/h/T55sdvf/H29tfqz/epCnI39OxzjJIz3QTPNlpk7rvaj4ZUkib0G1NKQUwTb36Rb0CdsvasX2hdMKhGwLqLM+PqjeFJACXMQT7OiyX2hUokAaHsPO0r7cR7HmUZzS5HESWQTTV42Blw3d1bNNFHYs1ALLCCZzBrImzmYaEAK3IADbmhuRAPNR8RgXQ2S++BFdWvQR2PMgb4H9CKxyIA/VwkJ/WMwklp9R3QR01CX5sdBpbp3ZcTSZFk+Fgo/gOM/knCo1soxcD/SLK3CZDsVIgdtE9X154VqkakZDWw9/Cr8B5ykM2dfjse/V2Y0TxTwDr5xKsdRs8AY+cYuwNyXtV0zadn5z0bosYcBlJsh30JAGe/XiiEwaLNtIuSQDjHCsMAx6Ks6jOOayDpFEYR83BeZIHYwiKkiwehcQWUxl3CxcwaJFmIUvjjFmwoUw8KqYKZXSeBSDidPDl2cHJ699C6xQeRKlFIO9zEEqjlUe6fCUmAK4emfTtrPePLDVYgrOll26J0ooWd1rSAS9QrnQJgLCz4Esg4XPhZzA+14X0jEI9jHFhC0h4z5Z9bGmNNMIFwD9boGKQYCgIItC+JYC9caF88EJCnjyB0dnJz8dvzk8OhsgRdsTWuNmYlRGYMidKCDbFmUOSziU+cQMuf4Ggc6mOsZKpgRcspBrdprAyPd3JaEyioEH8rn14dV7FQAC5BwH4PjDFHrQtuc3IFjAA/FzbwP4YwOx7TVz4ogOfsWOzfcqvWjnbNfqfXvC6hVpBZRFeQ5MA0GLOEz7Ae+BcCiOSVPDpai2nLU7NSsHfcmCQHN5ivwMXSBagSmidowK4GvTCoQ6sOp4ykVYdegRyBT1mgHQKQKqCpdaMKqtvrO9794e7b0+OD3e2z/opKYvkJ1WmYiGw70S8MnB6U9H+29b23RtwEkZN2yDmaeBlS+xBf7ItQZ5dbD34uDk7cGrg/2zwzdHK4eCdUolyFdPpxDlgAqt3U2YW6jyA1R9nViiTfezyjwAG4dYjIZZC1JUIyXKNHpXgv5CftDM3Fx6DQqePNjILOEJsiYRKthoHLEcFkLGlIGHHpcs2+ELEM3Ds5+WzfhbYMDFnQvaTThR42V7GvSNk+JVThwHazRdsquGD1qRQv8EfmtzKbllw3xsPWrGKn9Rp/0On6b/XxVY3nEh8BX1v1u7O938/6Pt7Y/53wd5Ov5/xQK1/1+n2chq1kEi6BZDRtYe1/C8I81ZLfDa9IztA9jKF80ewmU7dA5/XOCmIaWVMf0rc04nf2Y8sN9ZCZ4r2TH8X4F5YXjFCWpy/sjryqOiAEuI9p7y1k0/Al2qBItguCiWVBJ6XIEs0YqiwfOqfBw4IoqOm9iMHrkZCkCBSbSHV3SOuUFCFb8YsGoy5m9mKjPlUZmym9MbctA5HV2UABGt4HiM/ZzTV9lLmqMpR6aIirLAQx9GI2qciEcac2qs0GTf8V/cmbXgawcTNTXRJ6CKi1pXEm2tn9CnjVAag2MF/IbW2p2MAVI0rX7bzn+HWU9r3icyH4Hf1Q+wrDigyCPBgzBVD99mScEoMVWHXqgV1VirglyahC0UuS7wJzjC4BRBC1oLmyNFHLGEG/P86j1m5qmkmQldVTnDep4rBS51mcbKGO4WyByWdGjLRjbAv49llAwsAkObeW2GuK5pVfXRKUO+RqTbyNv6dxLEurLZxaGqBO7SmPoqtLgM4jkscstzr19jMw99hH3LGuRXj8VIVmFMroClFRWowwrgWqa0S4OSSe8GyLIxQQEGIxdDgkttphShIhtBlHyhYliwXJeTKW7ltLnXpwAdOq+K7Doz63Njg6hTYGApX0aLAQp6CZMIAnWMTzauhAwgFiFwXMSxrvm3hwAQK4doJjSqKW1VI295Xl2MRG9tqJeVI+jkA1l8OTMb0fb7r8uvRo823Cm6ATkAha2L+q3NDhagjx/cPFEXDsTXYK1t/uC5hcQxM6jac4WqtG/P39HOYbWtSIdG6nN9eLCBbMRTz3mkrPXJK23kQHBUMgXOiNC8zFRZB5XgHhNqO493v2a6YIzDLE7BGMouz5OntR+Dmaj4amHOnUZu/mv2bGKziE9MVGGq8ybODAwBKkTa/CdEzwBhyNkUmy9Ys00/M853RyF+6qI53qMk+1Np+TH97Rw3QSoVBMmCQ7GJL8hYSAy8CuA3CMVIlCguaCLNhGMMTqmJc6vBzhXkiVdudkZ++RIquaaWvzvTrfpznuhFlFNyZ/4mZ63iuU0A9a6b2a/V2xeiR1X/FiCd4mko1I7nz5+76rTh9Xf3HZyE+mUe8wjujZWzPO5kELvtmzVe9c8rxd3HKiCP45qLqN5a6o7jvnbDQmJ5qoETT15GrSlSSiueybnpQz/2WDSzDhgJwwkTkEw6Psu5yBDtI4jpCCWZ/J2BGM4wdWIIXLWhPoF1m+F2psyR69fF8Lfk3dDlwawnpckVIycKPSUSUswgM0lpWMdcV+gpbttQUsJiV/HWDDD9avOr3eoF4DMQEEbwm/ps8DVHbHRoDUuYnNGsBw2oza8HaZjpKC0O0ouB2Mfo+PXe0fenb7/9/h+HR2//6/V/vj04ekGprOVTmRZF1tCt9ijzNfF2rVcjbVusxPjk4PTNCnSJB14wj4Tkb69bza1Cm5CeYmJMVgIAPvi5EaC1yNfzMZ2FLh16tJKgVUqNvQZSdgGoE1Jo5P5hIi6u0lPoZ2Jdhmic7GbSBGUuVTqJUnXdJa47XLLEVaPVS/z9yd7B0cvDo4NVS4xFvYFMromXbR1Ho0vwso1WIvXm+OBof+/1q8PnKxbSSrCl3VIjaJv4Qdf6IYcatrNLmldfq+a4nm7yfdH70l/lbHJuuah3B27k9kE/R2FjSpUvxY4/1WaJ//4nOfkrm+PnukuYmqO62JwntdJ9rptcOu+ubcrpEChVyKyLTyncHfy9tm/VXQTQHmvxKUjfq8Uui9K0juRcgrgZHI9VAZbDhsYc7llTg66aV8ll5d+j/IExjhkseXM2PYznV21EGObRGKKAjO5AuG5sVZ1SWhpbcZXQDcKoT1eGUdWh4MtY6VMeq+FVfK4TUD+8CD0HpPdFY5huUvEaS2iPItQLSP4I6MVVLtCn4ALRiceeGwz3JsTnrsSGAYq/vbMlSN2j0E9dGIlN8AQwuaruWLROOz4mxOtKwlhM/tVIfdGZ+jXW2x7MuKfVxtPlwIqyUW6PW3uWPBDAxtGF9ahdgRdluyM8Hh2WAfJ3MWgRhxNQFhQHpyoHfx2x59s/ZFpVgrl7UdizdiVRLpbtZ3anDHMVfwBndvN/zfxvPpLBfVwCcUX9x/buzuNO/ndr58nH+x8e5LF6B/M2q2pAqlgE2aOTFz6mdC1GlQlYSrJIGD+g8IzAayhACYYR3kTQzDXiWW66YCFsWiRvAgoT31FZr4R/4jCAMI6LjiHMxw33PMebfFB2X/7wT4g+RjFlbocmDzawWM3/LZoMB+BboqYRcmRQBsjEUUhjrdRIVYnjEaCUzm1N8zq4KjPyQ4tGnbPxVBjVxcBNBUckkWUx1Xn0G2mcxbNvbHtPdKxuVSVzy9QhlVIPPLdfuJAPrveKfXFYWO+bF9dgbp4TpIZTuph4xdUjcLiCtDOP6fj1FiHFtEzwao+8exsSuj9At5d4iI92vq1lsLvf9ZYefnJ3O/TWRa9ydPAPazJtJ0B4RB3AH8avyCH47wyLd6jNLcbc4KM9raEb7ywG7s1yRDJCAH6UGZ74gVZelTDikIaIT5dwiCG1HkLMg5WlfLgw71NlPZWWVNltg7zJgTWB402Xxh7IUzG0We0qDKdcOrsDS9ZgGSECnY6jSSIzJgHnUfknH1SlCSL7A1OnBad5KKd+vWWBH8xkDfo0ScYzWLZ6S5etg8h944DJi2V41HtiTCvgDgWCbNQ1mfX2GLkwJVUFOgrAXFYBLUPTNiYcMUijS3zuG8NA5UWfS5/zFXhhk2iM9+XcNTbdY8o309fP4QWeAXxItQ3D2tIIR8VLsPbcUeemkbkujqYkDUI49t19Ea0SOUJ+BbBLi+muU9npolZXzhKC2lOu9iWu6pzsnYNW25HidDtLaZVrb+w33sZE3842911N1L3WsVZ2vCtWWuehrQu8ROQJlTsQqluJ0r8lQw9E3tvJ200EzU7kDxa3VSFgM/6zg9i6wLuLBK+I/yAA7MZ/j3c/xn8P89wg/lt+Nqejbivh7/D2NeT/Eh6/Vx3AjSnqXDHVRkJpRYapuQe5HL4Vvj9b5aG/wWVR93kB9BX1f5uPuvc/w6tHH+X/QZ41cSxzECO+zZNSmY0SP74b88eFKjORgL+Gm8mYGeAAlfeX1XvwKVzM6grm1NxWykEEC+AaWVUqmwvpQ2tbGQNYvFPG3dm8skoPwKHq4pQuJoJWVLMObT0ebVdgDM4FGGKi0jJKVVWbB/BccR4fuHEF7dUhYvW+oBQIn4ffa5xgV3ySgUsTU8p/ADjKuPNpnF9xi32k6tPvtiYDe+fgbtBxHnvOgDdSqs2ZcZQbrH1cE/27ezzODVWTvGPoXvP0AtKvuggA1bnfTIjQgUzOwvOh7ZAKVWryAx947vQC5iS46vLs1Wnrby6WWm9d1y2wEMmyEcQYwCi85wXg8OwUHei2y1EPF9kTFMgDMR5i5UsL7LYHoJ5kxZwubzX2dtUlZ8WrxE1puPyzc/bb4AW39gB44wh7r4eUw4suBeGNOLg6LbeTbmtxq2vO1vhKzMX2SEUqhoGZZnFE15TzPThrdnsIu6S6Fm4rnU8X4dhtm6oYkfojrvYqXqrjdGBwz9cWAOeqRXii7EAMn+Hnb/xn9UboN0O82vdIuyO5WILr4FBNMYmtxslTuhK3ZVgNADlZedkDPjbt2KxvZLLeJX+z9FSnsu9ceJy4rNcXJyOJHbVXFvSysmgi5g5yGOUqa5sbfc0tYh/8NlA7EuUReY0bu0pggDQubHacBhnYcmgZoni0rsx35Rso2r7nkEFviR1He5uUx8UQVHDlDp+tLo2w574KORmIqjYia5w/Oxwf6eIY768CTgV8X2vKVktW57Z2kiyPHONdWM4mtM7TVKcADSp4Vg4k4tx7VM5xd3UsaU8dN2Exd8v8l/B4VMhK1erNo6ZYoNk+5OOIsOZqafHskeGLrPH4WXvLnuJ0YnWrjvCMIvmtqbs2GssmAVqqZA4zG+dKWa7ggkpJVEuDOZaPj9w64Wusw6SLulvnnwbi8abntU7c4HVvqqrnCLJyILY3uQ4lAV2Bq7fz5HWE7niURJ12nYaPtnegpdf2thdYxAUMLMHHjRRQm//FcZUO/oHTwTRBPhDXacr7Id5anS0hOtFd3XQ2sNooqhR6CLQZyWCRg+9DqzQ0+10CB3C1fON/vMLuWbfuyKEb2/kWd0rbdv+7HMZWgaOvhK3oP8thMOENmtk6ThUw2tDAfQ0QERk3rgavKkyWEfRHKi+p7pK3hr2+4Jz3BGv7wgc/JbL+8JkrZPlm41llVr/Byu1noDe+GTYMc1XOiP3DZjVxXTZe1YGuUkodfeQ16q+5lHr7ZUQ7Nk3D1qzKcRdQUJkVS6m9MLFyLG1TOhbizhfbQ8hlimc27W3y8lzVXoY970JXzLN3iyFp5X2nBKn+wDfQU639QmV0rAMZ97H+lzrx8si6cBkje7pHx/xfe1fP0zAMRHf/CitsCAKCTjAiBhYG1ipS08Zto0ZxlbY0EuK/c/fuEjtDxcKGb0zixI7t+/C9uxuAJK2vWE8q6UdfxEhrBxQOTCOpwOlq3oMeXsMRg2zJTO3umnopIsBE6LUIu3bsSreud2aCUJvNHqXTcCu3CviSo2THHIqRMpGTwr4Ed8TzNJh46/AmUTl5ply/Bx5RIoPZRa2iljs/gNCyzExhZnpa/4ZLYbnHZRDGcgujGiueuVMn2bh40ccIrpxDgz9ZQjuophwodCJbqT3S74UkIMXrrAr2kpZJFaKhNcTAxIhn4J3R8QBLFv77oek+xcXr7AKa58KOieHrTetRHYcF17lm3Us2HFivplvyrbnSy4OOSaulL1ccLIyCDijTAFAy3Is2u85yo7BvOy+YMapcALYINSHkC3S7XDHmatP4pesLuSVb8Z72YmjZ8YadNKSvFDzK18OKLFO7ZYkLRSiCtMJOCQG3v0Lt2Ai8DLZ7JxYI6wATR0MMKPKvb2oqr78dLj+hv5PcwdTtjfM3uoGL8MCYB1iekDsRbNbOA7q1CIq8BotpxA+N8wBhWwLw11R6SnAchIda1sxmiCWxFFhD6cTigI0wLo7cqANdx8bTJAOKk7naB5mlkKbVzg9bv89dX3IehpzEwJ/VP0qUKFGiRIkSJfpv9AMal/EoAHgAAA=='
CHART_SHA256='5e8436f9861b2648a0b57accb361f2a1f2de982378fee89d03045566ccb5b21a'
CHART_BUILT='2026-08-22'

KUBECONFIG_PATH="${KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"
CERT_MANAGER_VERSION="${CERT_MANAGER_VERSION:-v1.17.2}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.2.1}"

# Everything below can be answered at the prompt or preset in the environment,
# which is what makes the same script usable from a terminal and from CI.
WORKSPACE="${WORKSPACE:-}"
PROFILE="${PROFILE:-}"
DOMAIN_BASE="${DOMAIN_BASE:-}"

PTAH_IMAGE_REPOSITORY="${PTAH_IMAGE_REPOSITORY:-public.ecr.aws/i5x9u8b2/ptah}"
PTAH_IMAGE_TAG="${PTAH_IMAGE_TAG:-latest}"
IMAGES_REGISTRY="${IMAGES_REGISTRY:-public.ecr.aws/i5x9u8b2}"
IMAGES_TAG="${IMAGES_TAG:-latest}"
STORAGE_CLASS="${STORAGE_CLASS:-local-path}"
STORAGE_SIZE="${STORAGE_SIZE:-5Gi}"
TRAEFIK_HTTPS_ENTRYPOINT_PORT="${TRAEFIK_HTTPS_ENTRYPOINT_PORT:-8443}"
LOCAL_ISSUER_NAME="${LOCAL_ISSUER_NAME:-converged-local-selfsigned}"
OPERATOR_CREATE="${OPERATOR_CREATE:-}"

if [[ "${EUID}" -ne 0 ]]; then
	printf 'Run this installer as root: curl -sfL <url> | sudo sh -\n' >&2
	exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"

# Piped through `sh -`, stdin is the script itself, so a prompt has to talk to
# the terminal directly. Opening /dev/tty is the test that matters: the device
# node exists in containers and CI where it cannot be opened, so checking for
# the file would pass and then read nothing. With no terminal the environment
# is the only input, and an unanswered question fails rather than quietly
# installing a differently-named platform than the one that was wanted.
ask() {
	local var="$1" question="$2" default="$3" answer=""
	if [[ -n "${!var}" ]]; then
		printf '%s: %s\n' "$question" "${!var}"
		return
	fi
	if ! { exec 3<>/dev/tty; } 2>/dev/null; then
		printf 'No terminal to ask "%s"; set %s in the environment.\n' "$question" "$var" >&2
		exit 1
	fi
	printf '%s [%s]: ' "$question" "$default" >&3
	read -r answer <&3 || answer=""
	exec 3>&-
	printf -v "$var" '%s' "${answer:-$default}"
}

# Asked at the end, but checked at the start: finding out there is no terminal
# after several minutes of installing k3s is the one failure worth spending a
# line to move forward.
require_answers_possible() {
	if [[ -n "$WORKSPACE" && -n "$PROFILE" && -n "$DOMAIN_BASE" ]]; then return; fi
	if { exec 3<>/dev/tty; } 2>/dev/null; then
		exec 3>&-
		return
	fi
	printf 'No terminal to prompt on. Set WORKSPACE, PROFILE and DOMAIN_BASE in the environment.\n' >&2
	exit 1
}

ask_workspace() {
	ask WORKSPACE "Workspace (namespace and platform name)" "converged"
	if [[ ! "$WORKSPACE" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
		printf 'Workspace %q is not a valid namespace name.\n' "$WORKSPACE" >&2
		exit 1
	fi

	ask PROFILE "Deployment type (mono | multi | cloud)" "mono"
	case "$PROFILE" in
		mono|multi|cloud) ;;
		*) printf 'Deployment type must be mono, multi or cloud (got %q).\n' "$PROFILE" >&2; exit 1 ;;
	esac

	ask DOMAIN_BASE "Domain base (hostnames are <name>.<domain>)" "4ir.local"
}

# The probe is expected to fail until it does not, so its own output is noise:
# a screen of "Error from server (NotFound)" reads like a broken installer
# rather than a healthy wait.
wait_for() {
	local description="$1"
	shift
	local attempts=0
	printf 'Waiting for %s' "$description"
	until "$@" >/dev/null 2>&1; do
		attempts=$((attempts + 1))
		if (( attempts >= 150 )); then
			printf '\nTimed out waiting for %s\n' "$description" >&2
			return 1
		fi
		printf '.'
		sleep 2
	done
	printf ' ok\n'
}

# Is there already a cluster with everything a platform needs? Each check names
# one thing install_* would otherwise create, so a half-built cluster — k3s up
# but no cert-manager — is treated as absent and completed rather than assumed
# ready and failed later.
cluster_ready() {
	command -v kubectl >/dev/null 2>&1 || return 1
	systemctl is-active --quiet k3s || return 1
	kubectl get --raw=/readyz >/dev/null 2>&1 || return 1
	kubectl get gatewayclass/traefik >/dev/null 2>&1 || return 1
	kubectl -n cert-manager get deployment/cert-manager >/dev/null 2>&1 || return 1
	kubectl get clusterissuer/"$LOCAL_ISSUER_NAME" >/dev/null 2>&1 || return 1
}

install_k3s() {
	if ! systemctl is-active --quiet k3s; then
		curl -sfL https://get.k3s.io | sh -
	fi
	wait_for "k3s API" kubectl get --raw=/readyz
	wait_for "a Ready node" sh -c 'kubectl get nodes --no-headers 2>/dev/null | awk '\''$2 == "Ready" { found=1 } END { exit !found }'\'''
}

install_helm() {
	if ! command -v helm >/dev/null 2>&1; then
		curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
	fi
}

install_gateway_api() {
	# The gateway provider is configured before traefik's chart runs: the
	# helm-controller reinstalls traefik when this changes, so setting it first
	# is one install instead of two.
	kubectl apply -f - <<'YAML'
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    providers:
      kubernetesGateway:
        enabled: true
        nativeLBByDefault: true
YAML

	# Traefik ships the Gateway API CRDs in its own `traefik-crd` chart, so they
	# arrive with it. Applying the upstream set first creates the same CRDs
	# without Helm's ownership labels, and `helm install traefik-crd` then
	# refuses to adopt them: traefik fails with "Required CRDs are missing" and
	# there is never a Deployment to wait for. So wait for traefik first, then
	# fill in only what it did not bring.
	wait_for "the traefik Deployment" kubectl -n kube-system get deployment/traefik
	kubectl -n kube-system rollout status deployment/traefik --timeout=5m

	if ! kubectl get crd gatewayclasses.gateway.networking.k8s.io >/dev/null 2>&1; then
		kubectl apply -f "https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"
	fi

	wait_for "the traefik GatewayClass" kubectl get gatewayclass/traefik
}

install_cert_manager() {
	kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.crds.yaml"
	kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"
	kubectl -n cert-manager rollout status deployment/cert-manager --timeout=5m
	kubectl -n cert-manager rollout status deployment/cert-manager-webhook --timeout=5m
	kubectl -n cert-manager rollout status deployment/cert-manager-cainjector --timeout=5m
}

install_local_issuer() {
	kubectl apply -f - <<YAML
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: ${LOCAL_ISSUER_NAME}
spec:
  selfSigned: {}
YAML
}

unpack_chart() {
	CHART_DIR="$(mktemp -d)"
	trap 'rm -rf "$CHART_DIR"' EXIT
	printf '%s' "$CHART_B64" | base64 -d > "$CHART_DIR/chart.tgz"
	# The digest is what makes a piped installer auditable: a payload that was
	# rewritten in transit fails here rather than in the cluster.
	local actual
	actual="$(sha256sum "$CHART_DIR/chart.tgz" | cut -d' ' -f1)"
	if [[ "$actual" != "$CHART_SHA256" ]]; then
		printf 'Embedded chart digest mismatch: expected %s, got %s\n' "$CHART_SHA256" "$actual" >&2
		exit 1
	fi
	mkdir -p "$CHART_DIR/chart"
	tar -xzf "$CHART_DIR/chart.tgz" -C "$CHART_DIR/chart"
}

install_ptah() {
	kubectl create namespace "$WORKSPACE" --dry-run=client -o yaml | kubectl apply -f -

	# Ptah references this Secret and never writes it: real credentials do not
	# travel through a custom resource, and they do not travel through an
	# installer either.
	if ! kubectl -n "$WORKSPACE" get secret "${WORKSPACE}-secrets" >/dev/null 2>&1; then
		printf 'Note: Secret %s/%s-secrets does not exist yet. Create it before the platform can serve traffic.\n' \
			"$WORKSPACE" "$WORKSPACE" >&2
	fi

	# The first release in a cluster brings the operator; later ones add a
	# Platform and let that operator drive it. Both Platform and Solution are
	# cluster-scoped, so a second operator would reconcile everything twice.
	if [[ -z "$OPERATOR_CREATE" ]]; then
		if kubectl get crd platforms.ptah.io >/dev/null 2>&1 \
			&& [[ -n "$(kubectl get deployment -A -l app.kubernetes.io/name=ptah -o name 2>/dev/null)" ]]; then
			OPERATOR_CREATE=false
		else
			OPERATOR_CREATE=true
		fi
	fi
	printf 'Operator: %s\n' "$([[ "$OPERATOR_CREATE" == true ]] && echo "installing" || echo "already present, adding a Platform only")"

	helm upgrade --install "${WORKSPACE}-ptah" "$CHART_DIR/chart" \
		--namespace "$WORKSPACE" \
		--create-namespace \
		--wait \
		--set operator.create="$OPERATOR_CREATE" \
		--set-string workspace="$WORKSPACE" \
		--set-string profile="$PROFILE" \
		--set-string domainBase="$DOMAIN_BASE" \
		--set-string image.repository="$PTAH_IMAGE_REPOSITORY" \
		--set-string image.tag="$PTAH_IMAGE_TAG" \
		--set-string images.registry="$IMAGES_REGISTRY" \
		--set-string images.tag="$IMAGES_TAG" \
		--set-string storage.storageClassName="$STORAGE_CLASS" \
		--set-string storage.size="$STORAGE_SIZE" \
		--set-string gateway.issuer="$LOCAL_ISSUER_NAME" \
		--set gateway.httpsPort="$TRAEFIK_HTTPS_ENTRYPOINT_PORT"

	if [[ "$OPERATOR_CREATE" == true ]]; then
		kubectl -n "$WORKSPACE" rollout status deployment/"${WORKSPACE}-ptah" --timeout=5m
	fi
	wait_for "the Gateway to be programmed" sh -c \
		"kubectl get gateway -n '$WORKSPACE' '$WORKSPACE' -o jsonpath='{.status.conditions[?(@.type==\"Programmed\")].status}' | grep -qx True"
}

printf 'Converged installer (chart %s, built %s)\n\n' "${CHART_SHA256:0:12}" "$CHART_BUILT"
require_answers_possible

# The cluster and its add-ons are the same whatever the answers turn out to be,
# so they are built first and the questions are asked once there is something
# to install into. On a host that already has them this is the whole difference
# between installing a cluster and adding a workspace to one.
install_helm
if cluster_ready; then
	printf 'Found k3s with traefik, the Gateway API and cert-manager. Adding a workspace to it.\n'
else
	install_k3s
	install_gateway_api
	install_cert_manager
	install_local_issuer
fi

printf '\nCluster is ready. Now the platform:\n\n'
ask_workspace
printf '\n'

unpack_chart
install_ptah

printf '\nConverged is installed in namespace %s (%s). Gateway: https://%s.%s/\n' \
	"$WORKSPACE" "$PROFILE" "$WORKSPACE" "$DOMAIN_BASE"

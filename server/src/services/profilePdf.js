const PDFDocument = require('pdfkit')

function generateProfilePdf(user) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'FixMate Profile', Author: 'FixMate' } })
    const chunks = []
    document.on('data', (chunk) => chunks.push(chunk))
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)

    const safeDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided'
    const address = user.address || {}
    document.rect(0, 0, 595, 110).fill('#173e38')
    document.fillColor('#e4b95e').fontSize(24).font('Helvetica-Bold').text('+', 56, 38)
    document.fillColor('#f8f4e9').fontSize(22).font('Helvetica-Bold').text('fixmate', 78, 40)
    document.fillColor('#24312d').fontSize(25).font('Helvetica-Bold').text('Profile information', 56, 155)
    document.fillColor('#78847c').fontSize(10).font('Helvetica').text(`Exported on ${safeDate(new Date())}`, 56, 190)
    document.moveTo(56, 220).lineTo(539, 220).strokeColor('#d9ded8').stroke()

    const section = (title, y) => {
      document.fillColor('#b08b3d').fontSize(9).font('Helvetica-Bold').text(title.toUpperCase(), 56, y)
      return y + 27
    }
    const field = (label, value, x, y, width = 220) => {
      document.fillColor('#7b877f').fontSize(9).font('Helvetica').text(label, x, y)
      document.fillColor('#24312d').fontSize(12).font('Helvetica-Bold').text(String(value || 'Not provided'), x, y + 14, { width })
    }

    let y = section('Account details', 250)
    field('Full name', user.name, 56, y)
    field('Email address', user.email, 305, y)
    field('Account type', user.role === 'admin' ? 'Administrator' : 'Homeowner', 56, y + 60)
    field('Email status', user.isVerified ? 'Verified' : 'Not verified', 305, y + 60)
    field('Member since', safeDate(user.createdAt), 56, y + 120)

    y = section('Home address', 455)
    field('Address', address.formatted || address.line1, 56, y, 483)
    field('City', address.city, 56, y + 60)
    field('State', address.state, 220, y + 60)
    field('Postal code', address.postalCode, 385, y + 60)
    if (user.avatar?.url) field('Profile picture', user.avatar.url, 56, y + 120, 483)
    document.fillColor('#8b958d').fontSize(9).font('Helvetica').text('This document contains the profile information currently stored in FixMate.', 56, 740)
    document.end()
  })
}

module.exports = { generateProfilePdf }
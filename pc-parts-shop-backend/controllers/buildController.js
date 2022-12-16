const { Build, BuildPart, Part } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllBuilds = catchAsync(async (req, res, next) => {
  const build = await Build.findAll();

  if (!build) return next(new AppError('No builds found'));

  res.status(200).json({
    status: 'success',
    build,
  });
});

function filtering(parts, removables) {
  let idxs = [];
  for (let removable of removables) {
    for (let i = 0; i < parts.length; i++) {
      if (removable === parts[i]) {
        idxs.push(i);
        break;
      }
    }
  }
  for (const idx of idxs) {
    parts.splice(idx, 1);
  }
  return parts;
}

exports.getBuild = catchAsync(async (req, res, next) => {
  const allParts = [
    'memory',
    'cpu',
    'ram',
    'psu',
    'gpu',
    'motherboard',
    'cooler',
  ];
  const { buildId } = req.query;

  const build = await Build.findOne({ where: { id: buildId } });

  if (!build) return next(new AppError("build doesn't exist"));

  const bParts = await BuildPart.findAll({ where: { buildId: buildId } });
  let ids = [];
  // get ids of parts who belong to the build
  for (const bpart of bParts) {
    ids.push(bpart.partId);
  }

  // get parts who belong to the build
  let parts = [];
  for (const anId of ids) {
    parts.push(await Part.findOne({ where: { id: anId } }));
  }

  // get part type who belong in the build
  let hold = [];
  for (const name of parts) {
    hold.push(name.type);
  }
  const left = filtering(allParts, hold); // get part types who are still missing until the full build

  // const parts = await Part.findAll({ where: { id: bParts.partId } });
  res.status(200).json({
    status: 'success',
    buildId: build.id,
    buildName: build.name,
    left, // parts who still can be added
    parts, // parts who are in the build
  });
});

exports.createBuild = catchAsync(async (req, res, next) => {
  const { name, userId } = req.query;
  if (name === 'undefined') {
    return next(new AppError('You need to put a proper build name'));
  }
  const build = await Build.findOne({ where: { name: name } });

  if (!build) {
    const newBuild = await Build.create({
      name: name,
      userId: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    res.status(200).json({
      status: 'success',
      id: newBuild.id,
    });
  } else {
    return next(new AppError('Build name already taken'));
  }
});

exports.removeBuild = catchAsync(async (req, res, next) => {
  const { buildId } = req.query;
  const build = await Build.findOne({ where: { id: buildId } });

  if (!build) return next(new AppError('No build found to destroy'));

  //remove parts from the build
  const bParts = await BuildPart.findAll({ where: { buildId: buildId } });
  if (bParts.length !== 0) {
    for (const bpart of bParts) {
      await bpart.destroy({ force: true });
    }
  }

  //remove the build
  await build.destroy({ force: true });

  res.status(204).json({});
});

exports.AddPartToBuild = catchAsync(async (req, res, next) => {
  const { buildId, partId } = req.query;

  const newBuildPart = await BuildPart.findOne({
    where: { partId: partId, buildId: buildId },
  });

  if (!newBuildPart) {
    const newItem = await BuildPart.create({
      quantity: 1,
      buildId: buildId,
      partId: partId,
    });
    res.status(200).json({
      status: 'success',
      item: newItem,
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Part already exists in the build',
    });
  }
});
